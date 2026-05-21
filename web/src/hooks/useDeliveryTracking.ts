import { useState, useRef, useCallback, useEffect } from 'react';
import { useGeolocation } from './useGeolocation';
import type { DoorData } from '../models/door';
import type { TrackPoint, TrackStop } from '../models/campaign';
import { apiPost, apiPatch } from '../lib/api';
import { keepAppActive } from '../utils/pwaHelpers';
import { simplifyTrack } from '../utils/trackSimplification';

type TrackingState = 'idle' | 'requesting' | 'active' | 'out_of_range' | 'left_area';

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Equirectangular distance in metres — cheap and accurate over short spans. */
function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = (((b.lng - a.lng) * Math.PI) / 180) * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng) * R;
}

function bboxDeltas(lat: number, radiusM: number): { dLat: number; dLng: number } {
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180));
  return { dLat, dLng };
}

function isNearAnyDoor(
  pos: { lat: number; lng: number },
  doors: { lat: number; lng: number }[],
  radiusM: number,
): boolean {
  const { dLat, dLng } = bboxDeltas(pos.lat, radiusM);
  const minLat = pos.lat - dLat, maxLat = pos.lat + dLat;
  const minLng = pos.lng - dLng, maxLng = pos.lng + dLng;
  for (const d of doors) {
    if (d.lat < minLat || d.lat > maxLat || d.lng < minLng || d.lng > maxLng) continue;
    if (distanceMeters(pos, d) <= radiusM) return true;
  }
  return false;
}

function getNearbyDoorIds(
  pos: { lat: number; lng: number },
  doors: { id: string; lat: number; lng: number }[],
  radiusM: number,
): string[] {
  const { dLat, dLng } = bboxDeltas(pos.lat, radiusM);
  const minLat = pos.lat - dLat, maxLat = pos.lat + dLat;
  const minLng = pos.lng - dLng, maxLng = pos.lng + dLng;
  const result: string[] = [];
  for (const d of doors) {
    if (d.lat < minLat || d.lat > maxLat || d.lng < minLng || d.lng > maxLng) continue;
    if (distanceMeters(pos, d) <= radiusM) result.push(d.id);
  }
  return result;
}

const MIN_DISTANCE_M = 5;
const MAX_INTERVAL_S = 10;
const STOP_RADIUS_M = 8;
const STOP_DWELL_S = 15;
const FLUSH_INTERVAL_MS = 30_000;
const OUTSIDE_GRACE_S = 30;
const MAX_DELIVERY_RETRIES = 3;
const MIN_WALKING_SPEED_MS = 0.3;
const MAX_WALKING_SPEED_MS = 2.5;

const LS_KEY = 'doordrop_active_delivery';

export type PersistedSession = {
  campaignId: string;
  sessionId: string;
  walkerId: string;
  startedAt: number;
  doorRadiusM: number;
};

function saveSession(session: PersistedSession) {
  localStorage.setItem(LS_KEY, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(LS_KEY);
}

export function getPersistedSession(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as PersistedSession) : null;
  } catch {
    return null;
  }
}

export function useDeliveryTracking() {
  const { position, error: geoError, requesting, startWatching, stopWatching } = useGeolocation();
  const [state, setState] = useState<TrackingState>('idle');
  const [distanceKm, setDistanceKm] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const prevPositionRef = useRef<{ lat: number; lng: number; t: number } | null>(null);
  const currentSpeedRef = useRef<number>(0);
  const doorsRef = useRef<{ id: string; lat: number; lng: number }[]>([]);
  const radiusMRef = useRef<number>(100);
  const outsideSinceRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const visitedDoorIdsRef = useRef<Set<string>>(new Set());
  const doorRetryCountRef = useRef<Map<string, number>>(new Map());
  const onDoorVisitedRef = useRef<((doorId: string) => void) | null>(null);

  const campaignIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const pointBufferRef = useRef<TrackPoint[]>([]);
  const lastRecordedRef = useRef<{ lat: number; lng: number; t: number } | null>(null);
  const currentStopRef = useRef<{ lat: number; lng: number; startTime: number } | null>(null);
  const pendingStopRef = useRef<TrackStop | null>(null);
  const flushedStopsRef = useRef<TrackStop[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const keepActiveRef = useRef<{ stop: () => void } | null>(null);

  const updateDoorVisitedCallback = useCallback((cb: ((doorId: string) => void) | null) => {
    onDoorVisitedRef.current = cb;
  }, []);

  const [autoStopResult, setAutoStopResult] = useState<{ distanceKm: number; durationMinutes: number } | null>(null);

  const [trackPoints, setTrackPoints] = useState<TrackPoint[]>([]);
  const [trackStops, setTrackStops] = useState<TrackStop[]>([]);
  const [trackSessionId, setTrackSessionId] = useState<string | null>(null);

  const [debugInfo, setDebugInfo] = useState<{
    sessionCreationError?: string;
    callbackRegistered: boolean;
    nearbyDoorsDetected: number;
    lastGeofenceCheck?: string;
    deliveryAttempts: number;
    deliveryErrors: string[];
    currentSpeedMs?: number;
    isWalkingPace?: boolean;
  }>({
    callbackRegistered: false,
    nearbyDoorsDetected: 0,
    deliveryAttempts: 0,
    deliveryErrors: [],
  });

  // Periodic flush to the Data Worker. Replaces the Firestore arrayUnion writes.
  const flushToWorker = useCallback(async () => {
    const sId = sessionIdRef.current;
    if (!sId) return;

    const points = pointBufferRef.current.splice(0);
    const newStops = flushedStopsRef.current.splice(0);
    const pending = pendingStopRef.current;
    if (pending) newStops.push({ ...pending });

    if (points.length === 0 && newStops.length === 0) return;

    const simplifiedPoints = points.length > 2 ? simplifyTrack(points, 0.0001, true) : points;
    if (points.length > 2) {
      console.log(
        `[GPS] Simplified ${points.length} → ${simplifiedPoints.length} points (${Math.round(
          (1 - simplifiedPoints.length / points.length) * 100,
        )}% reduction)`,
      );
    }

    try {
      await apiPost(`/v1/track-sessions/${sId}/append`, {
        points: simplifiedPoints,
        stops: newStops,
      });
    } catch (err) {
      console.error('[GPS] flushToWorker failed:', err);
      // Re-buffer for the next flush so we don't lose data.
      pointBufferRef.current.unshift(...simplifiedPoints);
      flushedStopsRef.current.unshift(...newStops.filter((s) => s !== pending));
    }
  }, []);

  const performStop = useCallback(
    (reason: 'manual' | 'left_area') => {
      stopWatching();
      const finalMinutes = startTime ? (Date.now() - startTime) / 60000 : 0;

      const sId = sessionIdRef.current;
      if (sId) {
        const points = pointBufferRef.current.splice(0);
        const stops = [...flushedStopsRef.current.splice(0)];
        if (pendingStopRef.current) stops.push(pendingStopRef.current);

        // Final flush + mark session ended. Fire-and-forget so the UI doesn't block.
        (async () => {
          try {
            if (points.length > 0 || stops.length > 0) {
              await apiPost(`/v1/track-sessions/${sId}/append`, { points, stops });
            }
            await apiPatch(`/v1/track-sessions/${sId}`, { ended_at: Date.now() });
          } catch (err) {
            console.error('[GPS] Failed final flush:', err);
          }
        })();
      }

      clearSession();
      setState(reason === 'left_area' ? 'left_area' : 'idle');
      if (timerRef.current) clearInterval(timerRef.current);
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);

      if (keepActiveRef.current) {
        keepActiveRef.current.stop();
        keepActiveRef.current = null;
      }

      const result = { distanceKm, durationMinutes: finalMinutes };
      setStartTime(null);
      prevPositionRef.current = null;
      doorsRef.current = [];
      outsideSinceRef.current = null;
      campaignIdRef.current = null;
      sessionIdRef.current = null;
      lastRecordedRef.current = null;
      currentStopRef.current = null;
      pendingStopRef.current = null;
      flushedStopsRef.current = [];
      visitedDoorIdsRef.current.clear();
      onDoorVisitedRef.current = null;
      setDistanceKm(0);
      setElapsedMinutes(0);
      return result;
    },
    [stopWatching, distanceKm, startTime],
  );

  useEffect(() => {
    if (state !== 'active' || !position) return;

    const now = Math.floor(Date.now() / 1000);
    const prev = prevPositionRef.current;

    let currentSpeed = 0;
    if (prev) {
      const distM = distanceMeters(prev, position);
      const timeDiff = now - prev.t;
      if (timeDiff > 0) currentSpeed = distM / timeDiff;
      currentSpeedRef.current = currentSpeed;
    }

    const isWalkingPace = currentSpeed >= MIN_WALKING_SPEED_MS && currentSpeed <= MAX_WALKING_SPEED_MS;

    const doors = doorsRef.current;
    const radiusM = radiusMRef.current;
    if (doors.length > 0) {
      if (isNearAnyDoor(position, doors, radiusM)) {
        outsideSinceRef.current = null;

        const nearbyIds = getNearbyDoorIds(position, doors, radiusM);
        const visited = visitedDoorIdsRef.current;
        const callback = onDoorVisitedRef.current;

        if (nearbyIds.length > 0) {
          setDebugInfo((d) => ({
            ...d,
            nearbyDoorsDetected: nearbyIds.length,
            lastGeofenceCheck: new Date().toISOString(),
            currentSpeedMs: currentSpeed,
            isWalkingPace,
          }));
        }

        nearbyIds.forEach((doorId) => {
          if (!visited.has(doorId)) {
            if (!prev || isWalkingPace) {
              visited.add(doorId);
              if (callback) {
                setDebugInfo((d) => ({ ...d, deliveryAttempts: d.deliveryAttempts + 1 }));
                Promise.resolve(callback(doorId)).catch((err) => {
                  const errorMsg = err instanceof Error ? err.message : String(err);
                  const retryCount = (doorRetryCountRef.current.get(doorId) || 0) + 1;
                  doorRetryCountRef.current.set(doorId, retryCount);

                  if (retryCount < MAX_DELIVERY_RETRIES) {
                    visited.delete(doorId);
                  }

                  setDebugInfo((d) => ({
                    ...d,
                    deliveryErrors: [...d.deliveryErrors, `${errorMsg} (attempt ${retryCount})`].slice(-5),
                  }));
                });
              } else {
                setDebugInfo((d) => ({
                  ...d,
                  deliveryErrors: [...d.deliveryErrors, 'No callback registered'].slice(-5),
                }));
              }
            } else {
              setDebugInfo((d) => ({
                ...d,
                deliveryErrors: [...d.deliveryErrors, `Too fast: ${(currentSpeed * 3.6).toFixed(1)} km/h`].slice(-5),
              }));
            }
          }
        });
      } else {
        const nowSec = Date.now() / 1000;
        if (outsideSinceRef.current === null) {
          outsideSinceRef.current = nowSec;
        } else if (nowSec - outsideSinceRef.current >= OUTSIDE_GRACE_S) {
          const result = performStop('left_area');
          setAutoStopResult(result);
          return;
        }
      }
    }

    if (prev) {
      const d = haversineDistance(prev.lat, prev.lng, position.lat, position.lng);
      if (d > 0.003) setDistanceKm((km) => km + d);
    }
    prevPositionRef.current = { ...position, t: now };

    const last = lastRecordedRef.current;
    const shouldRecord =
      !last || distanceMeters(last, position) >= MIN_DISTANCE_M || now - last.t >= MAX_INTERVAL_S;

    if (shouldRecord) {
      const pt: TrackPoint = { lat: position.lat, lng: position.lng, t: now, speed: currentSpeed };
      pointBufferRef.current.push(pt);
      setTrackPoints((prevPts) => [...prevPts, pt]);
      lastRecordedRef.current = pt;
    }

    const stop = currentStopRef.current;
    if (stop) {
      if (distanceMeters(stop, position) <= STOP_RADIUS_M) {
        const dwell = now - stop.startTime;
        if (dwell >= STOP_DWELL_S) {
          const stopEntry: TrackStop = {
            lat: stop.lat,
            lng: stop.lng,
            startTime: stop.startTime,
            endTime: now,
          };
          pendingStopRef.current = stopEntry;
          setTrackStops((prevStops) => {
            const existing = prevStops.findIndex((s) => s.startTime === stop.startTime);
            if (existing >= 0) {
              const updated = [...prevStops];
              updated[existing] = stopEntry;
              return updated;
            }
            return [...prevStops, stopEntry];
          });
        }
      } else {
        if (pendingStopRef.current) {
          flushedStopsRef.current.push(pendingStopRef.current);
          pendingStopRef.current = null;
        }
        currentStopRef.current = { lat: position.lat, lng: position.lng, startTime: now };
      }
    } else {
      currentStopRef.current = { lat: position.lat, lng: position.lng, startTime: now };
    }
  }, [position, state, performStop]);

  useEffect(() => {
    if (state !== 'requesting' || !position) return;
    const doors = doorsRef.current;
    const radiusM = radiusMRef.current;
    if (doors.length === 0) return;
    if (isNearAnyDoor(position, doors, radiusM)) {
      setState('active');
      setStartTime(Date.now());
      prevPositionRef.current = { ...position, t: Math.floor(Date.now() / 1000) };
    } else {
      setState('out_of_range');
      stopWatching();
    }
  }, [position, state, stopWatching]);

  useEffect(() => {
    if (state === 'active' && startTime) {
      timerRef.current = setInterval(() => {
        setElapsedMinutes((Date.now() - startTime) / 60000);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state, startTime]);

  useEffect(() => {
    if (state === 'active' && trackSessionId) {
      flushTimerRef.current = setInterval(() => void flushToWorker(), FLUSH_INTERVAL_MS);
    }
    return () => {
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
    };
  }, [state, trackSessionId, flushToWorker]);

  const startTracking = useCallback(
    async (
      doors: (DoorData & { id?: string })[],
      campaignId?: string,
      walkerId?: string,
      doorRadiusM?: number,
      onDoorVisited?: (doorId: string) => void,
    ) => {
      const withCoords = doors.filter((d) => d.lat && d.lng && d.id);
      if (withCoords.length === 0) return;

      doorsRef.current = withCoords.map((d) => ({ id: d.id!, lat: d.lat!, lng: d.lng! }));
      radiusMRef.current = doorRadiusM ?? 100;
      outsideSinceRef.current = null;
      visitedDoorIdsRef.current = new Set();
      onDoorVisitedRef.current = onDoorVisited || null;

      setDebugInfo({
        callbackRegistered: !!onDoorVisited,
        nearbyDoorsDetected: 0,
        deliveryAttempts: 0,
        deliveryErrors: [],
      });

      setDistanceKm(0);
      setElapsedMinutes(0);
      setStartTime(null);
      prevPositionRef.current = null;
      lastRecordedRef.current = null;
      currentStopRef.current = null;
      pendingStopRef.current = null;
      flushedStopsRef.current = [];
      pointBufferRef.current = [];
      setTrackPoints([]);
      setTrackStops([]);

      // Create session via Worker. Replaces Firestore addDoc.
      if (campaignId) {
        campaignIdRef.current = campaignId;
        try {
          const res = await apiPost<{ id: string; started_at: number }>(
            `/v1/campaigns/${campaignId}/track-sessions`,
          );
          sessionIdRef.current = res.id;
          setTrackSessionId(res.id);
          saveSession({
            campaignId,
            sessionId: res.id,
            walkerId: walkerId || '',
            startedAt: Date.now(),
            doorRadiusM: doorRadiusM ?? 100,
          });
          console.log(`[Tracking] Session created: ${res.id}`);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.error('Failed to create track session:', err);
          setDebugInfo((d) => ({ ...d, sessionCreationError: errorMsg }));
        }
      }

      keepActiveRef.current = keepAppActive();
      console.log('[Tracking] Wake lock and background heartbeat enabled');

      setState('requesting');
      startWatching();
    },
    [startWatching],
  );

  const resumeTracking = useCallback(
    (
      doors: (DoorData & { id?: string })[],
      session: PersistedSession,
      onDoorVisited?: (doorId: string) => void,
    ) => {
      const withCoords = doors.filter((d) => d.lat && d.lng && d.id);
      if (withCoords.length === 0) return;

      doorsRef.current = withCoords.map((d) => ({ id: d.id!, lat: d.lat!, lng: d.lng! }));
      radiusMRef.current = session.doorRadiusM;
      outsideSinceRef.current = null;
      visitedDoorIdsRef.current = new Set();
      onDoorVisitedRef.current = onDoorVisited || null;

      campaignIdRef.current = session.campaignId;
      sessionIdRef.current = session.sessionId;
      setTrackSessionId(session.sessionId);
      setStartTime(session.startedAt);
      setElapsedMinutes((Date.now() - session.startedAt) / 60000);

      prevPositionRef.current = null;
      lastRecordedRef.current = null;
      currentStopRef.current = null;
      pendingStopRef.current = null;
      flushedStopsRef.current = [];
      pointBufferRef.current = [];
      setTrackPoints([]);
      setTrackStops([]);
      setDistanceKm(0);

      setDebugInfo({
        callbackRegistered: !!onDoorVisited,
        nearbyDoorsDetected: 0,
        deliveryAttempts: 0,
        deliveryErrors: [],
      });

      keepActiveRef.current = keepAppActive();
      setState('active');
      startWatching();
      console.log(`[Tracking] Resumed session: ${session.sessionId}`);
    },
    [startWatching],
  );

  const stopTracking = useCallback(() => performStop('manual'), [performStop]);

  const dismissError = useCallback(() => {
    setState('idle');
    setAutoStopResult(null);
  }, []);

  return {
    state,
    position,
    geoError,
    requesting,
    distanceKm,
    elapsedMinutes,
    startTracking,
    resumeTracking,
    stopTracking,
    dismissError,
    trackPoints,
    trackStops,
    trackSessionId,
    autoStopResult,
    debugInfo,
    updateDoorVisitedCallback,
  };
}
