import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { CampaignRepository } from "../../repositories/campaignRepository";
import { DoorRepository } from "../../repositories/doorRepository";
import { useAuthContext } from "../../hooks/useAuthContext";
import { useUserData } from "../../hooks/useUserData";
import { UserRepository } from "../../repositories/userRepository";
import type { CampaignData, CampaignStatus } from "../../models/campaign";
import { isCampaignClosed, getNextActions, type ActorRole } from "../../models/campaign";
import type { DoorData, DeliveryEvent } from "../../models/door";
import CampaignMap from "../../components/campaign/CampaignMap";
import DoorReportModal from "../../components/campaign/DoorReportModal";
import PrintoutManager from "../../components/campaign/PrintoutManager";
import WalkerInterestPanel from "../../components/campaign/WalkerInterestPanel";
import CampaignStats from "../../components/campaign/CampaignStats";
import AssignedWalkerCard from "../../components/campaign/AssignedWalkerCard";
import PublishReadinessModal from "../../components/campaign/PublishReadinessModal";
import CampaignCommandHeader from "../../components/campaign/CampaignCommandHeader";
import CampaignExceptionBanner from "../../components/campaign/CampaignExceptionBanner";
import CampaignFlyerPanel from "../../components/campaign/CampaignFlyerPanel";
import PrintoutSelector from "../../components/campaign/PrintoutSelector";
import MutationErrorBanner from "../../components/campaign/clientDetail/MutationErrorBanner";
import CampaignDetailsSection from "../../components/campaign/clientDetail/CampaignDetailsSection";
import WalkerTrackingSection from "../../components/campaign/clientDetail/WalkerTrackingSection";
import DoorManagementPanels from "../../components/campaign/clientDetail/DoorManagementPanels";
import { DraftFlyerNotices } from "../../components/campaign/clientDetail/ActiveFlyerCards";
import ReviewSection from "../../components/campaign/clientDetail/ReviewSection";
import { CampaignNoteRepository, type CampaignNote } from "../../repositories/campaignNoteRepository";
import Notes from "../UserInfoPage/Dashboard/Notes";
import { useDeliveryTracking } from "../../hooks/useDeliveryTracking";
import { useCampaignData } from "../../hooks/useCampaignData";
import { useCampaignTrackSessions } from "../../hooks/useCampaignTrackSessions";
import { useDoorManagement } from "../../hooks/useDoorManagement";
import { usePrintoutManagement } from "../../hooks/usePrintoutManagement";
import { useWalkerInterest } from "../../hooks/useWalkerInterest";

const ClientCampaignDetailPage: React.FC = () => {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { currentUser } = useAuthContext();
  const { userData } = useUserData();

  const {
    campaign,
    doors,
    printouts,
    interestedWalkers,
    loading,
    hasReviewed,
    reviewCheckDone,
    assignedWalkerName,
    setCampaign,
    setDoors,
    setPrintouts,
    setInterestedWalkers,
    setHasReviewed,
  } = useCampaignData(campaignId, currentUser?.id);

  const [statusUpdating, setStatusUpdating] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [printoutError, setPrintoutError] = useState<string | null>(null);
  // Active-flyer choice not yet saved (kept after a failed save so it can be retried)
  const [pendingPrintoutId, setPendingPrintoutId] = useState<string | null>(null);

  const [editBudget, setEditBudget] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editDoorRadius, setEditDoorRadius] = useState("");
  const [editJunkMailPolicy, setEditJunkMailPolicy] = useState<"deliver" | "skip">("deliver");
  const [editPropertyFilter, setEditPropertyFilter] = useState<"all" | "residential" | "commercial">("all");
  const [savingDetails, setSavingDetails] = useState(false);

  const [showPublishModal, setShowPublishModal] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const [expandedDoorId, setExpandedDoorId] = useState<string | null>(null);
  const [dismissedExceptions, setDismissedExceptions] = useState<Set<string>>(new Set());

  const activePrintoutId = campaign?.activePrintoutId || "";

  const [reportingDoor, setReportingDoor] = useState<(DoorData & { id: string }) | null>(null);

  const [showReviewForm, setShowReviewForm] = useState(false);

  const [notes, setNotes] = useState<CampaignNote[]>([]);
  const [noteInput, setNoteInput] = useState("");
  const [noteLoading, setNoteLoading] = useState(false);

  // Aggregated track data from polling the worker (replaces Firestore onSnapshot).
  const { polledTrackPoints, polledTrackStops } = useCampaignTrackSessions(campaignId);

  const isAdmin = campaign?.adminIds?.includes(currentUser?.id || "") || false;
  const isAssignedWalker = campaign?.assignedWalkerId === currentUser?.id;
  const campaignClosed = campaign?.status ? isCampaignClosed(campaign.status) : false;
  const canAddFlyers = campaign?.status && !["assigned", "complete", "review", "payment", "archive"].includes(campaign.status);

  const {
    state: trackingState,
    position: walkerPosition,
    geoError,
    distanceKm,
    elapsedMinutes,
    startTracking,
    stopTracking,
    dismissError,
    trackPoints: liveTrackPoints,
    trackStops: liveTrackStops,
    autoStopResult,
    debugInfo: trackingDebugInfo,
    updateDoorVisitedCallback,
  } = useDeliveryTracking();

  const isTracking = trackingState === "active";
  const canEditDoors = (isAdmin || (isAssignedWalker && isTracking)) && !campaignClosed;

  const doorManagement = useDoorManagement(campaignId, currentUser?.id, campaign, doors, setDoors);
  const printoutManagement = usePrintoutManagement(
    campaignId,
    currentUser?.id,
    setPrintouts,
    campaign?.activePrintoutId,
    (update) => setCampaign((prev) => (prev ? { ...prev, ...update } : prev))
  );
  const walkerInterest = useWalkerInterest(
    campaignId,
    currentUser?.id,
    isAdmin,
    setInterestedWalkers,
    setCampaign,
  );

  useEffect(() => {
    if (campaign) {
      setEditBudget(campaign.budget != null ? String(campaign.budget) : "");
      setEditDueDate(campaign.dueDate ? new Date(campaign.dueDate).toISOString().split("T")[0] : "");
      setEditDoorRadius(campaign.doorRadiusM != null ? String(campaign.doorRadiusM) : "");
      setEditJunkMailPolicy(campaign.junkMailPolicy ?? "deliver");
      setEditPropertyFilter(campaign.propertyFilter ?? "all");
    }
  }, [campaign]);

  useEffect(() => {
    if (!campaignId) return;
    const unsub = CampaignNoteRepository.subscribeToNotes(campaignId, setNotes);
    return unsub;
  }, [campaignId]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignId || !currentUser || !noteInput.trim()) return;
    setNoteLoading(true);
    setMutationError(null);
    try {
      const userName = userData?.name || currentUser.login || "Unknown";
      await CampaignNoteRepository.addNote(campaignId, noteInput.trim(), userName, currentUser.id);
      setNoteInput("");
    } catch (err) {
      console.error("Failed to add note:", err);
      setMutationError("We couldn't add your note. Please try again.");
    } finally {
      setNoteLoading(false);
    }
  };

  useEffect(() => {
    if (trackingState !== "left_area" || !autoStopResult || !currentUser) return;
    if (autoStopResult.distanceKm > 0 || autoStopResult.durationMinutes > 0) {
      void UserRepository.incrementWalkerStats(currentUser.id, {
        kmWalked: Math.round(autoStopResult.distanceKm * 100) / 100,
        minutesSpent: Math.round(autoStopResult.durationMinutes),
      });
    }
  }, [trackingState, autoStopResult, currentUser]);

  const displayTrackPoints = trackingState === "active" ? liveTrackPoints : polledTrackPoints;
  const displayTrackStops = trackingState === "active" ? liveTrackStops : polledTrackStops;

  const latestTrackPoint = displayTrackPoints.length > 0 ? displayTrackPoints[displayTrackPoints.length - 1] : null;
  const mapWalkerPosition = isTracking ? walkerPosition : latestTrackPoint;

  const hasRecentActivity = latestTrackPoint ? (Math.floor(Date.now() / 1000) - latestTrackPoint.t < 30) : false;
  const shouldFollowTracker = isTracking || hasRecentActivity;

  // The DebugPanel that consumed a verbose aggregate debug object was dropped
  // in the port. The component-level DeliveryTrackingPanel reads the SDK's
  // trackingDebugInfo directly (see prop above), which is sufficient.

  const handleStatusChange = async (newStatus: CampaignStatus) => {
    if (!campaignId || !isAdmin) return;
    setStatusUpdating(true);
    setMutationError(null);
    try {
      const updates: Partial<CampaignData> = { status: newStatus };
      if (newStatus === "complete") updates.completedAt = new Date();
      if (newStatus === "archive") updates.archivedAt = new Date();
      await CampaignRepository.updateGroup(campaignId, updates);
      setCampaign((prev) => (prev ? { ...prev, ...updates } : prev));

      if (newStatus === "complete" && campaign?.assignedWalkerId) {
        const walkerId = campaign.assignedWalkerId;
        const deliveredDoors = doors.filter((d) => d.status === "delivered" && d.deliveredBy === walkerId).length;
        await UserRepository.incrementWalkerStats(walkerId, {
          campaignsCompleted: 1,
          doorsDelivered: deliveredDoors,
        });
      }
    } catch (err) {
      console.error("Failed to update status:", err);
      setMutationError("We couldn't update the campaign status. Please try again.");
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleSaveDetails = async () => {
    if (!campaignId || !isAdmin) return;
    setSavingDetails(true);
    setMutationError(null);
    try {
      const updates: Partial<CampaignData> = {};
      const budgetNum = parseFloat(editBudget);
      if (!isNaN(budgetNum) && budgetNum > 0) updates.budget = budgetNum;
      if (editDueDate) updates.dueDate = new Date(editDueDate);
      const radiusNum = parseFloat(editDoorRadius);
      if (!isNaN(radiusNum) && radiusNum > 0) updates.doorRadiusM = radiusNum;
      updates.junkMailPolicy = editJunkMailPolicy;
      updates.propertyFilter = editPropertyFilter;
      updates.totalDoors = doors.length;
      await CampaignRepository.updateGroup(campaignId, updates);
      setCampaign((prev) => (prev ? { ...prev, ...updates } : prev));
    } catch (err) {
      console.error("Failed to save details:", err);
      setMutationError("We couldn't save your changes. Your details have been kept—please try again.");
    } finally {
      setSavingDetails(false);
    }
  };

  const handlePublish = () => {
    if (!campaignId || !isAdmin) return;
    setShowPublishModal(true);
  };

  const handleConfirmPublish = async () => {
    if (!campaignId || !isAdmin) return;

    // Validate required fields
    if (!campaign?.activePrintoutId) {
      setMutationError("Please select an active flyer before publishing. Walkers need to know what to deliver.");
      return;
    }

    if (doors.length === 0) {
      setMutationError("Please select at least one delivery location before publishing.");
      return;
    }

    if (!campaign?.doorRadiusM || campaign.doorRadiusM <= 0) {
      setMutationError("Please set a delivery radius before publishing.");
      return;
    }

    if (!campaign?.suburb || !campaign?.postcode || !campaign?.state) {
      setMutationError("Location is not complete. Please verify suburb, postcode, and state.");
      return;
    }

    setIsPublishing(true);
    setMutationError(null);
    try {
      const budgetNum = parseFloat(editBudget);
      const updates: Partial<CampaignData> = {
        status: "ready",
        jobStatus: "posted",
        totalDoors: doors.length,
        junkMailPolicy: editJunkMailPolicy,
        propertyFilter: editPropertyFilter,
      };
      if (!isNaN(budgetNum) && budgetNum > 0) updates.budget = budgetNum;
      if (editDueDate) updates.dueDate = new Date(editDueDate);
      const radiusNum = parseFloat(editDoorRadius);
      if (!isNaN(radiusNum) && radiusNum > 0) updates.doorRadiusM = radiusNum;
      await CampaignRepository.updateGroup(campaignId, updates);
      setCampaign((prev) => (prev ? { ...prev, ...updates } : prev));
      setShowPublishModal(false);
    } catch (err) {
      console.error("Failed to publish campaign:", err);
      setMutationError("We couldn't publish your campaign. Your changes have been kept—please try again.");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSaveDraft = () => {
    setShowPublishModal(false);
  };

  const handleSelectActivePrintout = async (id: string) => {
    if (!campaignId) return;
    setPrintoutError(null);
    setPendingPrintoutId(id);
    try {
      await CampaignRepository.updateGroup(campaignId, { activePrintoutId: id || undefined });
      setCampaign((prev) => (prev ? { ...prev, activePrintoutId: id || undefined } : prev));
      setPendingPrintoutId(null);
    } catch (err) {
      // Keep the chosen value in the selector so the admin can retry
      console.error("Failed to update active flyer:", err);
      setPrintoutError("We couldn't update the active flyer. Your selection has been kept—please try again.");
    }
  };

  const doorsRef = useRef(doors);
  doorsRef.current = doors;
  const activePrintoutIdRef = useRef(activePrintoutId);
  activePrintoutIdRef.current = activePrintoutId;

  const handleDoorVisited = useCallback(
    async (doorId: string) => {
      if (!campaignId || !currentUser) return;
      const currentDoors = doorsRef.current;
      const door = currentDoors.find((d) => d.id === doorId);
      if (!door || door.status === "delivered" || door.status === "reported") return;

      const event: DeliveryEvent = {
        date: new Date(),
        deliveredBy: currentUser.id,
        ...(activePrintoutIdRef.current && { printoutVersionId: activePrintoutIdRef.current }),
      };

      try {
        await DoorRepository.recordDelivery(campaignId, doorId, event);
        setDoors((prev) =>
          prev.map((d) =>
            d.id === doorId
              ? {
                  ...d,
                  status: "delivered" as const,
                  deliveredAt: event.date,
                  deliveredBy: event.deliveredBy,
                  deliveryCount: (d.deliveryCount || 0) + 1,
                  history: [...(d.history || []), event],
                }
              : d,
          ),
        );
      } catch (err) {
        console.error(`Auto-delivery failed for ${doorId}:`, err);
      }
    },
    [campaignId, currentUser],
  );

  useEffect(() => {
    if (trackingState === "active") {
      updateDoorVisitedCallback(handleDoorVisited);
    }
  }, [trackingState, handleDoorVisited, updateDoorVisitedCallback]);

  const handleDoorClick = async (door: DoorData & { id?: string }) => {
    if (!campaignId || !door.id || !canEditDoors) return;
    if (door.status === "reported") return;
    if (door.status === "delivered") {
      try {
        await DoorRepository.updateDoor(campaignId, door.id, { status: "pending" });
        setDoors((prev) => prev.map((d) => (d.id === door.id ? { ...d, status: "pending" } : d)));
      } catch (err) {
        console.error("Failed to update door status:", err);
      }
    } else {
      const event: DeliveryEvent = {
        date: new Date(),
        deliveredBy: currentUser?.id || "",
        ...(activePrintoutId && { printoutVersionId: activePrintoutId }),
      };
      try {
        await DoorRepository.recordDelivery(campaignId, door.id, event);
        setDoors((prev) =>
          prev.map((d) =>
            d.id === door.id
              ? {
                  ...d,
                  status: "delivered" as const,
                  deliveredAt: event.date,
                  deliveredBy: event.deliveredBy,
                  deliveryCount: (d.deliveryCount || 0) + 1,
                  history: [...(d.history || []), event],
                }
              : d,
          ),
        );
      } catch (err) {
        console.error("Failed to record delivery:", err);
      }
    }
  };

  const handleDoorReport = useCallback((door: DoorData & { id: string }) => {
    setReportingDoor(door);
  }, []);

  const handleDoorReported = useCallback((doorId: string) => {
    setDoors((prev) => prev.map((d) => (d.id === doorId ? { ...d, status: "reported" as const } : d)));
    setReportingDoor(null);
  }, []);

  const handleStopTracking = async () => {
    const result = stopTracking();
    if (currentUser && (result.distanceKm > 0 || result.durationMinutes > 0)) {
      await UserRepository.incrementWalkerStats(currentUser.id, {
        kmWalked: Math.round(result.distanceKm * 100) / 100,
        minutesSpent: Math.round(result.durationMinutes),
      });
    }
  };

  const doorsByStreet = useMemo(() => {
    const grouped: Record<string, {
      doors: (DoorData & { id: string })[];
      delivered: number;
      pending: number;
      reported: number;
    }> = {};
    doors.forEach((door) => {
      const street = door.streetName;
      if (!grouped[street]) grouped[street] = { doors: [], delivered: 0, pending: 0, reported: 0 };
      grouped[street].doors.push(door);
      if (door.status === "delivered") grouped[street].delivered++;
      else if (door.status === "reported") grouped[street].reported++;
      else grouped[street].pending++;
    });
    return grouped;
  }, [doors]);

  const [expandedStreets, setExpandedStreets] = useState<Set<string>>(new Set());
  const toggleStreet = useCallback((street: string) => {
    setExpandedStreets((prev) => {
      const next = new Set(prev);
      if (next.has(street)) next.delete(street);
      else next.add(street);
      return next;
    });
  }, []);

  const computedCenter = useMemo(() => {
    const withCoords = doors.filter((d) => d.lat && d.lng);
    if (withCoords.length > 0) {
      return {
        lat: withCoords.reduce((s, d) => s + d.lat!, 0) / withCoords.length,
        lng: withCoords.reduce((s, d) => s + d.lng!, 0) / withCoords.length,
      };
    }
    if (campaign?.lat != null && campaign?.lng != null) {
      return { lat: campaign.lat, lng: campaign.lng };
    }
    return { lat: -33.8688, lng: 151.2093 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doors.length, campaign?.lat, campaign?.lng]);

  const mapDoors = useMemo(
    () =>
      doors.filter(
        (d) =>
          !doorManagement.currentStreet ||
          d.streetName !== doorManagement.currentStreet.streetName ||
          !doorManagement.availableAddresses.some((a) => a.houseNumber === d.houseNumber),
      ),
    [doors, doorManagement.currentStreet, doorManagement.availableAddresses],
  );

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <p className="text-gray-600 dark:text-gray-400">Campaign not found.</p>
      </div>
    );
  }

  const effectiveCenter = doorManagement.currentStreet ? doorManagement.mapCenter : computedCenter;
  const deliveredCount = doors.filter((d) => d.status === "delivered").length;
  const reportedCount = doors.filter((d) => d.status === "reported").length;
  const activeDoorRadius = campaign.doorRadiusM ?? undefined;

  const nextActorRole: ActorRole = isAdmin ? (userData?.role === "admin" ? "platform_admin" : "campaign_admin") : "assigned_walker";
  const availableActions = campaign?.status ? getNextActions(campaign.status, nextActorRole) : [];

  // The details editor's fields.
  const detailsEditorProps = {
    campaign,
    statusUpdating,
    isPublishing,
    budget: editBudget,
    dueDate: editDueDate,
    doorRadius: editDoorRadius,
    junkMailPolicy: editJunkMailPolicy,
    propertyFilter: editPropertyFilter,
    doorCount: doors.length,
    saving: savingDetails,
    onBudgetChange: setEditBudget,
    onDueDateChange: setEditDueDate,
    onDoorRadiusChange: setEditDoorRadius,
    onJunkMailPolicyChange: setEditJunkMailPolicy,
    onPropertyFilterChange: setEditPropertyFilter,
    onSave: handleSaveDetails,
    onPublish: handlePublish,
  };

  // The walker tracking panel's props.
  const walkerTrackingProps = {
    campaign,
    trackingState,
    geoError,
    walkerPosition,
    elapsedMinutes,
    distanceKm,
    debugInfo: trackingDebugInfo,
    isAdmin: isAdmin || false,
    doors,
    campaignId,
    currentUserId: currentUser?.id,
    onStartTracking: startTracking,
    onStopTracking: handleStopTracking,
    onDismissError: dismissError,
    onDoorVisited: handleDoorVisited,
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto p-4 space-y-6">
        {/* Global error */}
        {mutationError && (
          <MutationErrorBanner message={mutationError} onDismiss={() => setMutationError(null)} />
        )}

        {/* Command Header */}
        <CampaignCommandHeader
          campaign={campaign}
          nextActions={availableActions}
          onActionClick={handleStatusChange}
          actionUpdating={statusUpdating}
          isAdmin={isAdmin}
        />

        {/* Exception Banner */}
        <CampaignExceptionBanner
          campaign={campaign}
          totalDoors={doors.length}
          dismissedExceptions={dismissedExceptions}
          onDismiss={(id) => setDismissedExceptions((prev) => new Set([...prev, id]))}
        />

        {/* Active flyer selector (draft only; locked once the campaign moves on) */}
        {isAdmin && campaign.status === "draft" && printouts.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700">
            <PrintoutSelector
              printouts={printouts}
              selectedPrintoutId={pendingPrintoutId ?? activePrintoutId}
              onSelectPrintout={handleSelectActivePrintout}
              error={printoutError}
              onDismissError={() => setPrintoutError(null)}
            />
          </div>
        )}

        {/* Main Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Primary Content Area - Left/Center */}
          <div className="lg:col-span-2 space-y-6">
            {/* Draft/Ready: the admin's settings and publish controls */}
            {(campaign.status === "draft" || campaign.status === "ready") && isAdmin && (
              <CampaignDetailsSection {...detailsEditorProps} />
            )}

            {/* Archived Campaign */}
            {campaign.status === "archive" && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900/20">
                <div className="flex gap-4">
                  <svg className="h-12 w-12 text-slate-400 dark:text-slate-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M4 3a2 2 0 100-4h12a2 2 0 100 4H4zm0 3h12v10a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm2-2a1 1 0 000 2h8a1 1 0 100-2H6z" />
                  </svg>
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">Campaign Archived</h2>
                    <p className="text-sm text-slate-700 dark:text-slate-300">This campaign has been archived and is no longer active.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Delivery stats, once the campaign has left draft */}
            {campaign.status !== "draft" && (
              <CampaignStats
                campaign={campaign}
                totalDoors={doors.length}
                deliveredCount={deliveredCount}
                reportedCount={reportedCount}
              />
            )}

            {/* Delivery Tracking Panel for Assigned Walker */}
            {isAssignedWalker && !campaignClosed && <WalkerTrackingSection {...walkerTrackingProps} />}
          </div>

          {/* Secondary Content Area - Right Sidebar */}
          <div className="space-y-6">
            {/* Active Flyer Panel */}
            {campaign.status !== "draft" && (
              <CampaignFlyerPanel
                campaign={campaign}
                printouts={printouts}
                onSelectFlyer={(id: string | undefined) => {
                  if (!campaignId) return;
                  CampaignRepository.updateGroup(campaignId, { activePrintoutId: id || undefined }).catch(
                    (err) => console.error("Failed to update active flyer:", err)
                  );
                }}
                isAdmin={isAdmin}
              />
            )}

            {/* Assigned Walker Card */}
            {campaign.assignedWalkerId && isAdmin && (
              <AssignedWalkerCard
                walkerName={
                  interestedWalkers.find((w) => w.walker.id === campaign.assignedWalkerId)?.walker.name ||
                  campaign.assignedWalkerId
                }
                onUnassign={walkerInterest.handleUnassignWalker}
                unassigning={walkerInterest.assigningWalkerId === "unassign"}
                isCampaignClosed={campaignClosed}
              />
            )}

            {/* Walker Interest Panel for Non-Draft */}
            {isAdmin && campaign.status !== "draft" && (
              <WalkerInterestPanel
                interestedWalkers={interestedWalkers}
                assignedWalkerId={campaign.assignedWalkerId || null}
                votingId={walkerInterest.votingId}
                assigningWalkerId={walkerInterest.assigningWalkerId}
                isCampaignClosed={campaignClosed}
                assignmentError={walkerInterest.assignmentError}
                onVote={walkerInterest.handleVote}
                onAssign={walkerInterest.handleAssignWalker}
                onDismissError={walkerInterest.dismissError}
              />
            )}
          </div>
        </div>

        {/* Printout Manager */}
        {isAdmin && (
          <PrintoutManager
            printouts={printouts}
            showForm={printoutManagement.showPrintoutForm}
            printoutName={printoutManagement.printoutName}
            printoutDesc={printoutManagement.printoutDesc}
            printoutFile={printoutManagement.printoutFile}
            printoutFilePreview={printoutManagement.printoutFilePreview}
            flyers={printoutManagement.flyers}
            flyersLoading={printoutManagement.flyersLoading}
            selectedFlyerId={printoutManagement.selectedFlyerId}
            saving={printoutManagement.savingPrintout}
            isCampaignClosed={!canAddFlyers}
            error={printoutManagement.printoutError}
            onToggleForm={() => printoutManagement.setShowPrintoutForm(!printoutManagement.showPrintoutForm)}
            onNameChange={printoutManagement.setPrintoutName}
            onDescChange={printoutManagement.setPrintoutDesc}
            onFileChange={(file, preview) => {
              printoutManagement.setPrintoutFile(file);
              printoutManagement.setPrintoutFilePreview(preview);
            }}
            onFlyerSelect={printoutManagement.selectFlyer}
            onSubmit={printoutManagement.handleCreatePrintout}
            onCancel={() => printoutManagement.setShowPrintoutForm(false)}
            onDismissError={printoutManagement.dismissError}
          />
        )}

        {/* Review Form/Prompt */}
        {isAdmin &&
          reviewCheckDone &&
          (campaign.status === "complete" || campaign.status === "review") &&
          campaign.assignedWalkerId &&
          !hasReviewed && (
            <ReviewSection
              walkerId={campaign.assignedWalkerId}
              walkerName={assignedWalkerName}
              reviewerId={currentUser?.id || ""}
              reviewerName={userData?.name}
              campaignId={campaignId!}
              completedDate={campaign.completedAt ? new Date(campaign.completedAt).toLocaleDateString() : undefined}
              showForm={showReviewForm}
              onRateNow={() => setShowReviewForm(true)}
              onSubmitted={() => {
                setShowReviewForm(false);
                setHasReviewed(true);
              }}
              onCancel={() => setShowReviewForm(false)}
            />
          )}

        {/* Notes Section */}
        {(isAdmin || isAssignedWalker) && (
          <Notes
            notes={notes}
            noteInput={noteInput}
            noteLoading={noteLoading}
            onNoteChange={setNoteInput}
            onAddNote={handleAddNote}
            formatDate={(date) => new Date(date).toLocaleString()}
          />
        )}

        {/* Notices while the campaign is a draft; once it moves on, the flyer panel in the sidebar shows the flyer */}
        {isAdmin && campaign.status === "draft" && (
          <DraftFlyerNotices printouts={printouts} activePrintoutId={activePrintoutId} />
        )}

        {/* Map and doors, for every status and role. Admins pick addresses here while the campaign is draft or ready. */}
        <div className="flex flex-col lg:flex-row gap-4">
          <CampaignMap
            center={effectiveCenter}
            doors={mapDoors}
            availableAddresses={doorManagement.availableAddresses}
            selectedDoorKeys={doorManagement.selectedDoorKeys}
            onMarkerClick={doorManagement.toggleAddress}
            onDoorClick={canEditDoors ? handleDoorClick : undefined}
            walkerPosition={mapWalkerPosition}
            trackPoints={displayTrackPoints.length > 0 ? displayTrackPoints : undefined}
            trackStops={displayTrackStops.length > 0 ? displayTrackStops : undefined}
            doorRadiusM={activeDoorRadius}
            isTracking={shouldFollowTracker}
            className="flex-1 h-[350px] lg:h-[600px] rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600"
          />

          <div className="w-full lg:w-96 flex flex-col gap-4 overflow-y-auto lg:max-h-[600px]">
            <DoorManagementPanels
              campaignId={campaignId!}
              campaign={campaign}
              doorManagement={doorManagement}
              showAddressSelection={isAdmin && (campaign.status === "draft" || campaign.status === "ready")}
              doorsByStreet={doorsByStreet}
              expandedStreets={expandedStreets}
              expandedDoorId={expandedDoorId}
              printouts={printouts}
              canEditDoors={canEditDoors}
              onToggleStreet={toggleStreet}
              onToggleDoor={setExpandedDoorId}
              onDoorClick={handleDoorClick}
              onDoorReport={handleDoorReport}
            />
          </div>
        </div>

        {/* Door Report Modal */}
        {reportingDoor && campaignId && currentUser && reportingDoor.propertyId && (
          <DoorReportModal
            campaignId={campaignId}
            door={reportingDoor}
            propertyId={reportingDoor.propertyId}
            reportedBy={currentUser.id}
            onClose={() => setReportingDoor(null)}
            onReported={handleDoorReported}
          />
        )}

        {/* Publish Readiness Modal */}
        <PublishReadinessModal
          isOpen={showPublishModal}
          isPublishing={isPublishing}
          campaignData={campaign}
          totalDoors={doors.length}
          doorRadiusKm={campaign?.doorRadiusM ? Math.round(campaign.doorRadiusM / 1000) : 0}
          onPublish={handleConfirmPublish}
          onSaveDraft={handleSaveDraft}
          onClose={() => setShowPublishModal(false)}
        />
      </div>
    </div>
  );
};

export default ClientCampaignDetailPage;
