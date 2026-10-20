import { useEffect, useState } from "react";
import { useApp } from "@proappstore/sdk";
import type { TrackPoint, TrackStop } from "../models/campaign";
import { apiGet } from "../lib/api";

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

/**
 * Track points and stops from the campaign's recent tracking sessions (the last 24h), for clients
 * watching a walker. Real-time via fas.rooms with a fallback poll.
 */
export function useCampaignTrackSessions(campaignId: string | undefined) {
  const [polledTrackPoints, setPolledTrackPoints] = useState<TrackPoint[]>([]);
  const [polledTrackStops, setPolledTrackStops] = useState<TrackStop[]>([]);

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

  return { polledTrackPoints, polledTrackStops };
}
