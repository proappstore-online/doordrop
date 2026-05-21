import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuthContext } from "../../hooks/useAuthContext";
import { useDeliveryTracking, getPersistedSession } from "../../hooks/useDeliveryTracking";
import { CampaignRepository } from "../../repositories/campaignRepository";
import { DoorRepository } from "../../repositories/doorRepository";
import { PropertyRepository } from "../../repositories/propertyRepository";
import { PrintoutRepository } from "../../repositories/printoutRepository";
import { UserRepository } from "../../repositories/userRepository";
import type { CampaignData } from "../../models/campaign";
import type { DoorData, DeliveryEvent } from "../../models/door";
import type { PrintoutData } from "../../models/printout";
import DoorReportModal from "../../components/campaign/DoorReportModal";
import DoorDetailPanel from "../../components/campaign/DoorDetailPanel";
import CampaignMap from "../../components/campaign/CampaignMap";
import { sortDoorsAlongStreet } from "../../utils/sortDoorsGeo";
import { campaignStatusColors } from "../../utils/campaignStatusColors";

const DOORS_POLL_MS = 5000;

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = (((b.lng - a.lng) * Math.PI) / 180) * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng) * R;
}

const WalkerDeliveryPage: React.FC = () => {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { currentUser } = useAuthContext();

  const [campaign, setCampaign] = useState<(CampaignData & { id: string }) | null>(null);
  const [doors, setDoors] = useState<(DoorData & { id: string })[]>([]);
  const [printouts, setPrintouts] = useState<(PrintoutData & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const activePrintoutId = campaign?.activePrintoutId || "";
  const [reportingDoor, setReportingDoor] = useState<(DoorData & { id: string }) | null>(null);
  const [selectedDoor, setSelectedDoor] = useState<(DoorData & { id: string }) | null>(null);

  const {
    state: trackingState,
    position: walkerPosition,
    geoError,
    distanceKm,
    elapsedMinutes,
    startTracking,
    resumeTracking,
    stopTracking,
    dismissError,
    autoStopResult,
    trackPoints,
    trackStops,
    updateDoorVisitedCallback,
  } = useDeliveryTracking();

  const [autoDeliver, setAutoDeliver] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

  const isTracking = trackingState === "active";
  const isAssignedWalker = campaign?.assignedWalkerId === currentUser?.id;
  const isCampaignClosed =
    campaign?.status === "complete" ||
    campaign?.status === "review" ||
    campaign?.status === "payment" ||
    campaign?.status === "archive";
  const canEditDoors = isAssignedWalker && isTracking && !isCampaignClosed;

  // Load campaign + printouts once
  useEffect(() => {
    if (!campaignId) return;
    void (async () => {
      setLoading(true);
      try {
        const [campaignData, printoutsData] = await Promise.all([
          CampaignRepository.getGroup(campaignId),
          PrintoutRepository.getVersions(campaignId),
        ]);
        setCampaign(campaignData);
        setPrintouts(printoutsData);
      } catch (err) {
        console.error("Failed to load campaign:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [campaignId]);

  // Live-ish doors via polling (replaces Firestore onSnapshot). Will move to
  // fas.rooms `doors:{campaignId}` if/when the worker broadcasts on door PATCH.
  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;
    const fetchDoors = async () => {
      try {
        const updated = await DoorRepository.getDoorsByCampaign(campaignId);
        if (!cancelled) setDoors(updated);
      } catch {
        /* swallow — next tick retries */
      }
    };
    void fetchDoors();
    const interval = setInterval(() => void fetchDoors(), DOORS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [campaignId]);

  // Handle auto-stop: save walker stats
  useEffect(() => {
    if (trackingState !== "left_area" || !autoStopResult || !currentUser) return;
    if (autoStopResult.distanceKm > 0 || autoStopResult.durationMinutes > 0) {
      void UserRepository.incrementWalkerStats(currentUser.id, {
        kmWalked: Math.round(autoStopResult.distanceKm * 100) / 100,
        minutesSpent: Math.round(autoStopResult.durationMinutes),
      });
    }
  }, [trackingState, autoStopResult, currentUser]);

  // Refs for stable auto-delivery callback
  const doorsRef = useRef(doors);
  doorsRef.current = doors;
  const activePrintoutIdRef = useRef(activePrintoutId);
  activePrintoutIdRef.current = activePrintoutId;

  const handleDoorVisited = useCallback(
    async (doorId: string) => {
      if (!campaignId || !currentUser) return;
      const door = doorsRef.current.find((d) => d.id === doorId);
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
        if (door.propertyId) {
          PropertyRepository.addAccessUser(door.propertyId, currentUser.id).catch(() => {});
        }
      } catch (err) {
        console.error(`Failed to auto-deliver ${doorId}:`, err);
      }
    },
    [campaignId, currentUser],
  );

  useEffect(() => {
    if (trackingState === "active") {
      updateDoorVisitedCallback(autoDeliver ? handleDoorVisited : null);
    }
  }, [trackingState, autoDeliver, handleDoorVisited, updateDoorVisitedCallback]);

  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current || doors.length === 0 || trackingState !== "idle") return;
    const session = getPersistedSession();
    if (!session || session.campaignId !== campaignId) return;
    resumedRef.current = true;
    resumeTracking(doors, session, autoDeliver ? handleDoorVisited : undefined);
  }, [doors, campaignId, trackingState, resumeTracking, autoDeliver, handleDoorVisited]);

  const handleDoorClick = async (door: DoorData & { id: string }) => {
    if (!campaignId || !canEditDoors) return;
    if (door.status === "reported") return;

    if (door.status === "delivered") {
      try {
        await DoorRepository.updateDoor(campaignId, door.id, { status: "pending" });
        setDoors((prev) => prev.map((d) => (d.id === door.id ? { ...d, status: "pending" } : d)));
      } catch (err) {
        console.error("Failed to update door:", err);
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
        if (door.propertyId && currentUser) {
          PropertyRepository.addAccessUser(door.propertyId, currentUser.id).catch(() => {});
        }
      } catch (err) {
        console.error("Failed to record delivery:", err);
      }
    }
  };

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

  const nearbyDistances = useMemo(() => {
    if (!walkerPosition) return new Map<string, number>();
    const radiusM = campaign?.doorRadiusM || 100;
    const result = new Map<string, number>();
    for (const door of doors) {
      if (!door.lat || !door.lng) continue;
      const dist = distanceMeters(walkerPosition, { lat: door.lat, lng: door.lng });
      if (dist <= radiusM) result.set(door.id, Math.round(dist));
    }
    return result;
  }, [walkerPosition, doors, campaign?.doorRadiusM]);

  const nearestPendingDoorId = useMemo(() => {
    let bestId: string | null = null;
    let bestDist = Infinity;
    for (const [doorId, dist] of nearbyDistances) {
      const door = doors.find((d) => d.id === doorId);
      if (door?.status === "pending" && dist < bestDist) {
        bestId = doorId;
        bestDist = dist;
      }
    }
    return bestId;
  }, [nearbyDistances, doors]);

  const nearestDoorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isTracking && nearestDoorRef.current) {
      nearestDoorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [nearestPendingDoorId, isTracking]);

  const streetGroups = useMemo(() => {
    const grouped: Record<string, (DoorData & { id: string })[]> = {};
    for (const door of doors) {
      const street = door.streetName || "Unknown";
      if (!grouped[street]) grouped[street] = [];
      grouped[street].push(door);
    }
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([street, streetDoors]) => ({
        street,
        doors: sortDoorsAlongStreet(streetDoors),
      }));
  }, [doors]);

  const liveDoor = useMemo(() => {
    if (!selectedDoor) return null;
    return doors.find((d) => d.id === selectedDoor.id) || null;
  }, [doors, selectedDoor?.id]);

  const deliveredCount = doors.filter((d) => d.status === "delivered").length;
  const progressPct = doors.length > 0 ? Math.round((deliveredCount / doors.length) * 100) : 0;

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

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <Link
          to={`/walker/campaign/${campaignId}`}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          &larr;
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
            {campaign.name}
          </h1>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${campaignStatusColors[campaign.status] || campaignStatusColors.draft}`}>
          {campaign.status}
        </span>
      </div>

      {isAssignedWalker && !isCampaignClosed && (
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 space-y-2">
          {trackingState === "idle" && (
            <div className="space-y-2">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Auto-delivery radius: <strong>{campaign.doorRadiusM || 100}m</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Auto-deliver doors</span>
                <button
                  onClick={() => setAutoDeliver(!autoDeliver)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${autoDeliver ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${autoDeliver ? "translate-x-5" : ""}`} />
                </button>
              </div>
              <button
                onClick={() => startTracking(doors, campaignId, currentUser?.id, campaign?.doorRadiusM || 100, autoDeliver ? handleDoorVisited : undefined)}
                className="w-full px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors"
              >
                Start Tracking
              </button>
            </div>
          )}

          {trackingState === "requesting" && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              Requesting location...
            </div>
          )}

          {trackingState === "active" && (
            <div className="space-y-2">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Time</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {Math.floor(elapsedMinutes)}:{String(Math.floor((elapsedMinutes % 1) * 60)).padStart(2, "0")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Distance</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {distanceKm.toFixed(2)} km
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs text-emerald-600 dark:text-emerald-400">Tracking</span>
                </div>
                <div className="flex-1" />
                {activePrintoutId && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[120px]">
                    {printouts.find((p) => p.id === activePrintoutId)?.name}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {autoDeliver ? "Auto-deliver" : "Manual"}
                </span>
                <button
                  onClick={() => setAutoDeliver(!autoDeliver)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${autoDeliver ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${autoDeliver ? "translate-x-5" : ""}`} />
                </button>
              </div>
              <button
                onClick={handleStopTracking}
                className="w-full px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
              >
                Stop Tracking
              </button>
            </div>
          )}

          {trackingState === "out_of_range" && (
            <div className="space-y-2">
              <p className="text-sm text-red-600 dark:text-red-400">
                You're not near any doors. Move closer and try again.
              </p>
              <button onClick={dismissError} className="text-sm text-gray-600 dark:text-gray-400 underline">
                Dismiss
              </button>
            </div>
          )}

          {trackingState === "left_area" && (
            <div className="space-y-2">
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Tracking stopped — you moved away from all doors.
              </p>
              <button onClick={dismissError} className="text-sm text-gray-600 dark:text-gray-400 underline">
                Dismiss
              </button>
            </div>
          )}

          {geoError && trackingState !== "out_of_range" && !walkerPosition && (
            <p className="text-sm text-amber-600 dark:text-amber-400">{geoError}</p>
          )}
        </div>
      )}

      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center gap-3">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {deliveredCount} / {doors.length}
        </span>
        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
        </div>
        <span className="text-sm font-semibold text-emerald-600">{progressPct}%</span>
        <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden ml-2">
          <button
            onClick={() => setViewMode("list")}
            className={`px-2 py-1 text-xs ${viewMode === "list" ? "bg-emerald-600 text-white" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400"}`}
            aria-label="List view"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode("map")}
            className={`px-2 py-1 text-xs ${viewMode === "map" ? "bg-emerald-600 text-white" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400"}`}
            aria-label="Map view"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </button>
        </div>
      </div>

      {viewMode === "map" && (
        <div className="flex-1">
          <CampaignMap
            center={
              walkerPosition ||
              (doors.find((d) => d.lat && d.lng)
                ? { lat: doors.find((d) => d.lat && d.lng)!.lat!, lng: doors.find((d) => d.lat && d.lng)!.lng! }
                : { lat: campaign.lat || -33.8688, lng: campaign.lng || 151.2093 })
            }
            doors={doors}
            walkerPosition={walkerPosition}
            trackPoints={trackPoints}
            trackStops={trackStops}
            doorRadiusM={campaign.doorRadiusM}
            isTracking={isTracking}
            onDoorClick={canEditDoors ? (door) => handleDoorClick(door as DoorData & { id: string }) : undefined}
            className="w-full h-full"
          />
        </div>
      )}

      {viewMode === "list" && (
        <div className="flex-1 overflow-y-auto">
          {streetGroups.map(({ street, doors: streetDoors }) => {
            const streetDelivered = streetDoors.filter((d) => d.status === "delivered").length;
            return (
              <div key={street}>
                <div className="sticky top-0 z-10 px-4 py-2 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{street}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {streetDelivered}/{streetDoors.length}
                  </span>
                </div>
                {streetDoors.map((door) => {
                  const dist = nearbyDistances.get(door.id);
                  const isNearest = door.id === nearestPendingDoorId;
                  const isNearby = dist != null;
                  return (
                    <div
                      key={door.id}
                      ref={isNearest ? nearestDoorRef : undefined}
                      onClick={() => canEditDoors && handleDoorClick(door)}
                      className={`flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-700/50 ${
                        canEditDoors && door.status !== "reported" ? "cursor-pointer active:bg-gray-50 dark:active:bg-gray-700" : ""
                      } ${
                        isNearby
                          ? "border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-900/10"
                          : "border-l-4 border-l-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100 w-12 text-right flex-shrink-0">
                          {door.houseNumber}
                        </span>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            door.status === "delivered"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
                              : door.status === "reported"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
                              : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                          }`}
                        >
                          {door.status}
                        </span>
                        {(door.deliveryCount || 0) > 1 && (
                          <span className="text-xs text-gray-400">{door.deliveryCount}x</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {isNearby && (
                          <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                            {dist}m
                          </span>
                        )}
                        {canEditDoors && door.status === "pending" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setReportingDoor(door);
                            }}
                            className="text-xs text-amber-500 hover:text-amber-600 dark:text-amber-400"
                          >
                            Report
                          </button>
                        )}
                        <Link
                          to={`/walker/campaign/${campaignId}/door/${door.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          title="Full details"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </Link>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDoor(door);
                          }}
                          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          title="Quick view"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
          {doors.length === 0 && (
            <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-8">No doors in this campaign.</p>
          )}
        </div>
      )}

      {liveDoor && (
        <DoorDetailPanel
          door={liveDoor}
          printouts={printouts}
          canEditDoors={canEditDoors}
          onDoorClick={handleDoorClick}
          onClose={() => setSelectedDoor(null)}
        />
      )}

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
    </div>
  );
};

export default WalkerDeliveryPage;
