import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { CampaignRepository } from "../../repositories/campaignRepository";
import { DoorRepository } from "../../repositories/doorRepository";
import { useAuthContext } from "../../hooks/useAuthContext";
import { useUserData } from "../../hooks/useUserData";
import { UserRepository } from "../../repositories/userRepository";
import type { CampaignData, CampaignStatus, TrackPoint, TrackStop } from "../../models/campaign";
import type { DoorData, DeliveryEvent } from "../../models/door";
import CampaignMap from "../../components/campaign/CampaignMap";
import DoorReportModal from "../../components/campaign/DoorReportModal";
import CampaignTabs from "../../components/campaign/CampaignTabs";
import CampaignDetailsEditor from "../../components/campaign/CampaignDetailsEditor";
import PrintoutManager from "../../components/campaign/PrintoutManager";
import WalkerInterestPanel from "../../components/campaign/WalkerInterestPanel";
import DeliveryTrackingPanel from "../../components/campaign/DeliveryTrackingPanel";
import CampaignStats from "../../components/campaign/CampaignStats";
import AssignedWalkerCard from "../../components/campaign/AssignedWalkerCard";
import DoorList from "../../components/campaign/DoorList";
import AddressSelectionPanel from "../../components/campaign/AddressSelectionPanel";
import StatusControlsBar from "../../components/campaign/StatusControlsBar";
import PrintoutSelector from "../../components/campaign/PrintoutSelector";
import CampaignNotices from "../../components/campaign/CampaignNotices";
import ReviewForm from "../../components/reviews/ReviewForm";
import ReviewPrompt from "../../components/reviews/ReviewPrompt";
import { CampaignNoteRepository, type CampaignNote } from "../../repositories/campaignNoteRepository";
import Notes from "../UserInfoPage/Dashboard/Notes";
import { useDeliveryTracking } from "../../hooks/useDeliveryTracking";
import { useCampaignData } from "../../hooks/useCampaignData";
import { useDoorManagement } from "../../hooks/useDoorManagement";
import { usePrintoutManagement } from "../../hooks/usePrintoutManagement";
import { useWalkerInterest } from "../../hooks/useWalkerInterest";
import { apiGet } from "../../lib/api";

const TRACK_SESSIONS_POLL_MS = 10_000;

interface TrackSessionListRow {
  id: string;
  walker_id: string;
  started_at: number;
  ended_at: number | null;
}

interface TrackSessionDetail extends TrackSessionListRow {
  points: TrackPoint[];
  stops: { lat: number; lng: number; startTime: number; endTime: number }[];
}

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

  const [editBudget, setEditBudget] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editDoorRadius, setEditDoorRadius] = useState("");
  const [editJunkMailPolicy, setEditJunkMailPolicy] = useState<"deliver" | "skip">("deliver");
  const [editPropertyFilter, setEditPropertyFilter] = useState<"all" | "residential" | "commercial">("all");
  const [savingDetails, setSavingDetails] = useState(false);

  const [expandedDoorId, setExpandedDoorId] = useState<string | null>(null);

  const activePrintoutId = campaign?.activePrintoutId || "";

  const [reportingDoor, setReportingDoor] = useState<(DoorData & { id: string }) | null>(null);

  const [showReviewForm, setShowReviewForm] = useState(false);

  const [notes, setNotes] = useState<CampaignNote[]>([]);
  const [noteInput, setNoteInput] = useState("");
  const [noteLoading, setNoteLoading] = useState(false);

  // Aggregated track data from polling the worker (replaces Firestore onSnapshot).
  const [polledTrackPoints, setPolledTrackPoints] = useState<TrackPoint[]>([]);
  const [polledTrackStops, setPolledTrackStops] = useState<TrackStop[]>([]);

  const isWalker = userData?.role === "walker";
  const isAdmin = campaign?.adminIds?.includes(currentUser?.id || "") || false;
  const isAssignedWalker = campaign?.assignedWalkerId === currentUser?.id;
  const isCampaignClosed = campaign?.status === "complete" || campaign?.status === "review" || campaign?.status === "payment" || campaign?.status === "archive";

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
  const canEditDoors = (isAdmin || (isAssignedWalker && isTracking)) && !isCampaignClosed;

  const doorManagement = useDoorManagement(campaignId, currentUser?.id, campaign, doors, setDoors);
  const printoutManagement = usePrintoutManagement(campaignId, currentUser?.id, setPrintouts);
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

  // Poll track sessions for this campaign (replaces Firestore onSnapshot).
  // Aggregates points + stops from sessions started in the last 24h, matching
  // the original behaviour. Move to fas.rooms `track:{campaignId}` later.
  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;

    const fetchAggregated = async () => {
      try {
        const sessions = await apiGet<TrackSessionListRow[]>(
          `/v1/campaigns/${campaignId}/track-sessions`,
        );
        const oneDayAgo = Math.floor(Date.now() / 1000) - 86_400;
        const recent = sessions.filter((s) => s.started_at >= oneDayAgo);
        if (recent.length === 0) {
          if (!cancelled) {
            setPolledTrackPoints([]);
            setPolledTrackStops([]);
          }
          return;
        }
        const details = await Promise.all(
          recent.map((s) => apiGet<TrackSessionDetail>(`/v1/track-sessions/${s.id}`).catch(() => null)),
        );
        const allPoints: TrackPoint[] = [];
        const allStops: TrackStop[] = [];
        for (const d of details) {
          if (!d) continue;
          if (Array.isArray(d.points)) allPoints.push(...d.points);
          if (Array.isArray(d.stops)) {
            for (const s of d.stops) {
              allStops.push({ lat: s.lat, lng: s.lng, startTime: s.startTime, endTime: s.endTime });
            }
          }
        }
        allPoints.sort((a, b) => a.t - b.t);
        allStops.sort((a, b) => a.startTime - b.startTime);
        if (!cancelled) {
          setPolledTrackPoints(allPoints);
          setPolledTrackStops(allStops);
        }
      } catch {
        /* swallow — next tick retries */
      }
    };

    void fetchAggregated();
    const interval = setInterval(() => void fetchAggregated(), TRACK_SESSIONS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [campaignId]);

  useEffect(() => {
    if (!campaignId) return;
    const unsub = CampaignNoteRepository.subscribeToNotes(campaignId, setNotes);
    return unsub;
  }, [campaignId]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignId || !currentUser || !noteInput.trim()) return;
    setNoteLoading(true);
    try {
      const userName = userData?.name || currentUser.login || "Unknown";
      await CampaignNoteRepository.addNote(campaignId, noteInput.trim(), userName, currentUser.id);
      setNoteInput("");
    } catch (err) {
      console.error("Failed to add note:", err);
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
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleSaveDetails = async () => {
    if (!campaignId || !isAdmin) return;
    setSavingDetails(true);
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
    } finally {
      setSavingDetails(false);
    }
  };

  const handlePublish = async () => {
    if (!campaignId || !isAdmin) return;
    setStatusUpdating(true);
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
    } catch (err) {
      console.error("Failed to publish campaign:", err);
    } finally {
      setStatusUpdating(false);
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

  const getStatusActions = (): { label: string; status: CampaignStatus; className: string }[] => {
    if (!isAdmin) return [];
    switch (campaign.status) {
      case "draft":
        return [];
      case "ready":
        return [{ label: "Back to Draft", status: "draft", className: "bg-gray-500 hover:bg-gray-600 text-white" }];
      case "assigned":
        return [{ label: "Mark Complete", status: "complete", className: "bg-indigo-600 hover:bg-indigo-700 text-white" }];
      case "complete":
        return [{ label: "Review", status: "review", className: "bg-yellow-500 hover:bg-yellow-600 text-white" }];
      case "review":
        return [{ label: "Payment", status: "payment", className: "bg-purple-600 hover:bg-purple-700 text-white" }];
      case "payment":
        return [{ label: "Archive", status: "archive", className: "bg-gray-600 hover:bg-gray-700 text-white" }];
      default:
        return [];
    }
  };

  const statusActions = getStatusActions();

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <CampaignTabs
        campaignId={campaignId!}
        campaignName={campaign.name}
        status={`${campaign.suburb} ${campaign.postcode}`}
        campaignStatus={campaign.status}
      />

      <StatusControlsBar
        statusActions={statusActions}
        statusUpdating={statusUpdating}
        onStatusChange={handleStatusChange}
      />

      <CampaignNotices
        campaignStatus={campaign.status}
        isCampaignClosed={isCampaignClosed}
        isWalker={isWalker}
        isAssignedWalker={isAssignedWalker}
      />

      {isAssignedWalker && !isCampaignClosed && (
        <DeliveryTrackingPanel
          trackingState={trackingState}
          doorRadiusM={campaign.doorRadiusM || 100}
          junkMailPolicy={campaign.junkMailPolicy}
          propertyFilter={campaign.propertyFilter}
          geoError={geoError}
          walkerPosition={walkerPosition}
          elapsedMinutes={elapsedMinutes}
          distanceKm={distanceKm}
          debugInfo={trackingDebugInfo}
          isAdmin={isAdmin || false}
          doors={doors}
          campaignId={campaignId}
          currentUserId={currentUser?.id}
          onStartTracking={startTracking}
          onStopTracking={handleStopTracking}
          onDismissError={dismissError}
          onDoorVisited={handleDoorVisited}
        />
      )}

      {isAdmin && campaign.status === "draft" && (
        <CampaignDetailsEditor
          budget={editBudget}
          dueDate={editDueDate}
          doorRadius={editDoorRadius}
          junkMailPolicy={editJunkMailPolicy}
          propertyFilter={editPropertyFilter}
          doorCount={doors.length}
          saving={savingDetails}
          onBudgetChange={setEditBudget}
          onDueDateChange={setEditDueDate}
          onDoorRadiusChange={setEditDoorRadius}
          onJunkMailPolicyChange={setEditJunkMailPolicy}
          onPropertyFilterChange={setEditPropertyFilter}
          onSave={handleSaveDetails}
          onPublish={handlePublish}
          publishDisabled={statusUpdating || doors.length === 0}
        />
      )}

      {campaign.status !== "draft" && (
        <CampaignStats
          campaign={campaign}
          totalDoors={doors.length}
          deliveredCount={deliveredCount}
          reportedCount={reportedCount}
        />
      )}

      {isAdmin && printouts.length > 0 && (
        <PrintoutSelector
          printouts={printouts}
          selectedPrintoutId={activePrintoutId}
          onSelectPrintout={async (id) => {
            if (!campaignId) return;
            await CampaignRepository.updateGroup(campaignId, { activePrintoutId: id || undefined });
            setCampaign((prev) => (prev ? { ...prev, activePrintoutId: id || undefined } : prev));
          }}
          locked={!!activePrintoutId}
        />
      )}

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
          {isAdmin && campaign.status === "draft" && (
            <AddressSelectionPanel
              suburb={campaign.suburb || ""}
              postcode={campaign.postcode || ""}
              state={campaign.state || ""}
              currentStreet={doorManagement.currentStreet}
              availableAddresses={doorManagement.availableAddresses}
              selectedDoorKeys={doorManagement.selectedDoorKeys}
              overpassLoading={doorManagement.overpassLoading}
              overpassError={doorManagement.overpassError}
              manualOpen={doorManagement.manualOpen}
              onStreetSelected={doorManagement.handleStreetSelected}
              onToggleAddress={doorManagement.toggleAddress}
              onToggleManual={() => doorManagement.setManualOpen(!doorManagement.manualOpen)}
              onDoorsGenerated={doorManagement.handleDoorsGenerated}
            />
          )}

          <DoorList
            campaignId={campaignId!}
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

      {isAdmin && (
        <PrintoutManager
          printouts={printouts}
          showForm={printoutManagement.showPrintoutForm}
          printoutName={printoutManagement.printoutName}
          printoutDesc={printoutManagement.printoutDesc}
          printoutFile={printoutManagement.printoutFile}
          printoutFilePreview={printoutManagement.printoutFilePreview}
          saving={printoutManagement.savingPrintout}
          isCampaignClosed={isCampaignClosed}
          onToggleForm={() => printoutManagement.setShowPrintoutForm(!printoutManagement.showPrintoutForm)}
          onNameChange={printoutManagement.setPrintoutName}
          onDescChange={printoutManagement.setPrintoutDesc}
          onFileChange={(file, preview) => {
            printoutManagement.setPrintoutFile(file);
            printoutManagement.setPrintoutFilePreview(preview);
          }}
          onSubmit={printoutManagement.handleCreatePrintout}
          onCancel={() => printoutManagement.setShowPrintoutForm(false)}
        />
      )}

      {campaign.assignedWalkerId && isAdmin && (
        <AssignedWalkerCard
          walkerName={interestedWalkers.find((w) => w.walker.id === campaign.assignedWalkerId)?.walker.name || campaign.assignedWalkerId}
          onUnassign={walkerInterest.handleUnassignWalker}
          unassigning={walkerInterest.assigningWalkerId === "unassign"}
          isCampaignClosed={isCampaignClosed}
        />
      )}

      {isAdmin && campaign.status !== "draft" && (
        <WalkerInterestPanel
          interestedWalkers={interestedWalkers}
          assignedWalkerId={campaign.assignedWalkerId || null}
          votingId={walkerInterest.votingId}
          assigningWalkerId={walkerInterest.assigningWalkerId}
          isCampaignClosed={isCampaignClosed}
          onVote={walkerInterest.handleVote}
          onAssign={walkerInterest.handleAssignWalker}
        />
      )}

      {isAdmin && reviewCheckDone && (campaign.status === "complete" || campaign.status === "review") && campaign.assignedWalkerId && !hasReviewed && (
        showReviewForm ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <ReviewForm
              walkerId={campaign.assignedWalkerId}
              reviewerId={currentUser?.id || ""}
              reviewerName={userData?.name}
              campaignId={campaignId!}
              scheduleId={campaignId}
              onSubmitted={() => {
                setShowReviewForm(false);
                setHasReviewed(true);
              }}
              onCancel={() => setShowReviewForm(false)}
            />
          </div>
        ) : (
          <ReviewPrompt
            onRateNow={() => setShowReviewForm(true)}
            completedDate={campaign.completedAt ? new Date(campaign.completedAt).toLocaleDateString() : undefined}
            walkerName={assignedWalkerName}
          />
        )
      )}

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
    </div>
  );
};

export default ClientCampaignDetailPage;
