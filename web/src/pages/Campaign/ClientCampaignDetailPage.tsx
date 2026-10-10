import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { useApp } from "@proappstore/sdk";
import { CampaignRepository } from "../../repositories/campaignRepository";
import { DoorRepository } from "../../repositories/doorRepository";
import { useAuthContext } from "../../hooks/useAuthContext";
import { useUserData } from "../../hooks/useUserData";
import { UserRepository } from "../../repositories/userRepository";
import type { CampaignData, CampaignStatus, TrackPoint, TrackStop } from "../../models/campaign";
import { isCampaignClosed, getNextActions, type ActorRole } from "../../models/campaign";
import type { DoorData, DeliveryEvent } from "../../models/door";
import CampaignMap from "../../components/campaign/CampaignMap";
import DoorReportModal from "../../components/campaign/DoorReportModal";
import CampaignDetailsEditor from "../../components/campaign/CampaignDetailsEditor";
import PrintoutManager from "../../components/campaign/PrintoutManager";
import WalkerInterestPanel from "../../components/campaign/WalkerInterestPanel";
import DeliveryTrackingPanel from "../../components/campaign/DeliveryTrackingPanel";
import CampaignStats from "../../components/campaign/CampaignStats";
import AssignedWalkerCard from "../../components/campaign/AssignedWalkerCard";
import DoorList from "../../components/campaign/DoorList";
import AddressSelectionPanel from "../../components/campaign/AddressSelectionPanel";
import PublishReadinessModal from "../../components/campaign/PublishReadinessModal";
import CampaignCommandHeader from "../../components/campaign/CampaignCommandHeader";
import CampaignExceptionBanner from "../../components/campaign/CampaignExceptionBanner";
import CampaignFlyerPanel from "../../components/campaign/CampaignFlyerPanel";
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
  const [mutationError, setMutationError] = useState<string | null>(null);

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
  const [polledTrackPoints, setPolledTrackPoints] = useState<TrackPoint[]>([]);
  const [polledTrackStops, setPolledTrackStops] = useState<TrackStop[]>([]);

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

  // Real-time track sessions via fas.rooms with fallback polling.
  // Aggregates points + stops from sessions started in the last 24h.
  const app = useApp() as any;
  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;

    const fetchAggregated = async () => {
      if (cancelled) return;
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

    const room = app?.rooms?.join(`campaign:${campaignId}`);
    if (room) {
      // Listen to tracking.changed events only
      room.onEvent((event: any) => {
        if (event.data?.type === 'tracking.changed' && event.data?.campaignId === campaignId) {
          void fetchAggregated();
        }
      });
      room.onReconnect(() => {
        void fetchAggregated();
      });
      room.onConnectionState((state: string) => {
        if (state === 'closed' || state === 'error') {
          if (!fallbackInterval) {
            fallbackInterval = setInterval(() => void fetchAggregated(), TRACK_SESSIONS_POLL_MS);
          }
        } else {
          if (fallbackInterval) {
            clearInterval(fallbackInterval);
            fallbackInterval = null;
          }
        }
      });
      void fetchAggregated();
      return () => {
        cancelled = true;
        room.close();
        if (fallbackInterval) clearInterval(fallbackInterval);
      };
    } else {
      void fetchAggregated();
      fallbackInterval = setInterval(() => void fetchAggregated(), TRACK_SESSIONS_POLL_MS);
      return () => {
        cancelled = true;
        if (fallbackInterval) clearInterval(fallbackInterval);
      };
    }
  }, [campaignId, app]);

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
  const availableActions = campaign?.status ? getNextActions(campaign.status as any, nextActorRole) : [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto p-4 space-y-6">
        {/* Global error */}
        {mutationError && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-200"
          >
            <div className="flex gap-3">
              <svg
                className="h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="flex-1">
                <p>{mutationError}</p>
              </div>
              <button
                type="button"
                onClick={() => setMutationError(null)}
                className="flex-shrink-0 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
              >
                ✕
              </button>
            </div>
          </div>
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

        {/* Main Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Primary Content Area - Left/Center */}
          <div className="lg:col-span-2 space-y-6">
            {/* Active Campaign: Show Map */}
            {campaign.status === "assigned" ? (
              <CampaignMap
                center={effectiveCenter}
                doors={mapDoors}
                doorRadiusM={activeDoorRadius}
                trackPoints={displayTrackPoints}
                trackStops={displayTrackStops}
                walkerPosition={mapWalkerPosition}
                isTracking={isTracking}
                onDoorClick={handleDoorClick}
              />
            ) : campaign.status === "draft" || campaign.status === "ready" ? (
              /* Draft/Ready: Show Details Editor */
              isAdmin ? (
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
                  publishDisabled={
                    statusUpdating ||
                    isPublishing ||
                    doors.length === 0 ||
                    !campaign?.activePrintoutId ||
                    !campaign?.doorRadiusM ||
                    campaign.doorRadiusM <= 0 ||
                    !campaign?.suburb ||
                    !campaign?.postcode
                  }
                />
              ) : null
            ) : campaign.status === "complete" || campaign.status === "review" || campaign.status === "payment" ? (
              /* Closed Campaigns: Show Stats */
              <CampaignStats
                campaign={campaign}
                totalDoors={doors.length}
                deliveredCount={deliveredCount}
                reportedCount={reportedCount}
              />
            ) : campaign.status === "archive" ? (
              /* Archived Campaign */
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
            ) : null}

            {/* Delivery Tracking Panel for Assigned Walker */}
            {isAssignedWalker && !campaignClosed && (
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

        {/* Address Selection & Door List (for draft/ready with admin) */}
        {isAdmin && (campaign.status === "draft" || campaign.status === "ready") && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <CampaignMap
                center={effectiveCenter}
                doors={mapDoors}
                doorRadiusM={activeDoorRadius}
                trackPoints={displayTrackPoints}
                trackStops={displayTrackStops}
                walkerPosition={mapWalkerPosition}
                isTracking={isTracking}
                onDoorClick={handleDoorClick}
              />
            </div>
            <div className="w-full lg:w-96 flex flex-col gap-4 overflow-y-auto lg:max-h-[600px]">
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
        )}

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
          !hasReviewed &&
          (showReviewForm ? (
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
          ))}

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

        {/* Publish Modal */}

      {isAssignedWalker && !campaignClosed && (
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
          publishDisabled={
            statusUpdating ||
            isPublishing ||
            doors.length === 0 ||
            !campaign?.activePrintoutId ||
            !campaign?.doorRadiusM ||
            campaign.doorRadiusM <= 0 ||
            !campaign?.suburb ||
            !campaign?.postcode
          }
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

      {/* Issue #21: Active flyer visibility and empty states */}
      {isAdmin && campaign.status === "draft" && (
        <>
          {/* Active Flyer Display - show what walkers will see */}
          {activePrintoutId && printouts.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-900/20">
              <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-100 mb-3">Active Flyer</h3>
              {(() => {
                const activePrintout = printouts.find((p) => p.id === activePrintoutId);
                if (!activePrintout) return null;
                return (
                  <div className="flex items-center gap-3">
                    {activePrintout.fileUrl && (
                      <img src={activePrintout.fileUrl} alt={activePrintout.name} className="h-16 w-16 rounded object-cover flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-emerald-900 dark:text-emerald-100">{activePrintout.name}</p>
                      <p className="text-sm text-emerald-800 dark:text-emerald-200">This is what walkers will deliver</p>
                      {activePrintout.flyerId && (
                        <p className="text-xs text-emerald-700 dark:text-emerald-300">From your flyer library</p>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Empty state: no printouts yet */}
          {printouts.length === 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/60 rounded-lg p-4">
              <div className="flex gap-3">
                <svg className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zm-11-1a1 1 0 11-2 0 1 1 0 012 0zm3 0a1 1 0 11-2 0 1 1 0 012 0zm3 0a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">No flyer selected</p>
                  <p className="text-sm text-blue-800 dark:text-blue-200">Walkers won't see anything to deliver. Upload a flyer or select one from your library to get started.</p>
                </div>
              </div>
            </div>
          )}

          {/* Warning: printouts exist but no active flyer */}
          {printouts.length > 0 && !activePrintoutId && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/60 rounded-lg p-4">
              <div className="flex gap-3">
                <svg className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-100">No active flyer set</p>
                  <p className="text-sm text-amber-800 dark:text-amber-200">Please select one of your flyers below before publishing. You won't be able to publish without an active flyer.</p>
                </div>
              </div>
            </div>
          )}

        </>
      )}

      {/* Show active flyer display to all users (not just admin) in non-draft status */}
      {activePrintoutId && printouts.length > 0 && campaign.status !== "draft" && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Flyer for This Campaign</h3>
          {(() => {
            const activePrintout = printouts.find((p) => p.id === activePrintoutId);
            if (!activePrintout) return null;
            return (
              <div className="flex items-center gap-3">
                {activePrintout.fileUrl && (
                  <img src={activePrintout.fileUrl} alt={activePrintout.name} className="h-16 w-16 rounded object-cover flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 dark:text-gray-100">{activePrintout.name}</p>
                  {activePrintout.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">{activePrintout.description}</p>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
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
