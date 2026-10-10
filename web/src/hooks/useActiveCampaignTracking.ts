// Real-time tracking via fas.rooms. A campaign is "actively tracking" if its
// latest track session has emitted a point in the last 30s. Falls back to polling
// when rooms are unavailable or disconnected.

import { useState, useEffect } from 'react';
import { useApp } from '@proappstore/sdk';
import { apiGet, ApiError } from '../lib/api';

const ACTIVE_THRESHOLD_MS = 30_000;
const POLL_INTERVAL_MS = 30_000;

interface TrackSessionRow {
  id: string;
  walker_id: string;
  started_at: number;
  ended_at: number | null;
}

interface FullSession extends TrackSessionRow {
  points: { t: number }[];
}

async function hasRecentActivity(campaignId: string): Promise<boolean> {
  try {
    const sessions = await apiGet<TrackSessionRow[]>(
      `/v1/campaigns/${campaignId}/track-sessions`,
    );
    const open = sessions.filter((s) => s.ended_at === null);
    if (open.length === 0) return false;
    const now = Date.now();
    for (const s of open) {
      try {
        const full = await apiGet<FullSession>(`/v1/track-sessions/${s.id}`);
        const last = full.points[full.points.length - 1];
        if (last && now - last.t * 1000 < ACTIVE_THRESHOLD_MS) return true;
      } catch {
        /* skip */
      }
    }
    return false;
  } catch (e) {
    if (e instanceof ApiError && (e.status === 403 || e.status === 404)) return false;
    return false;
  }
}

export function useActiveCampaignTracking(campaignIds: string[]) {
  const [activeCampaigns, setActiveCampaigns] = useState<Set<string>>(new Set());
  const app = useApp() as any;

  useEffect(() => {
    if (campaignIds.length === 0) {
      setActiveCampaigns(new Set());
      return;
    }
    let cancelled = false;
    const rooms: Map<string, any> = new Map();
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;
    let anyRoomActive = false;

    const check = async () => {
      const results = await Promise.all(
        campaignIds.map(async (id) => [id, await hasRecentActivity(id)] as const),
      );
      if (cancelled) return;
      setActiveCampaigns(new Set(results.filter(([, active]) => active).map(([id]) => id)));
    };

    // Try to set up rooms for real-time tracking updates via tracking.changed events
    if (app?.rooms) {
      for (const campaignId of campaignIds) {
        const room = app.rooms.join(`campaign:${campaignId}`);
        rooms.set(campaignId, room);

        // Listen to tracking.changed events only
        room.onEvent((event: any) => {
          if (event.data?.type === 'tracking.changed' && event.data?.campaignId === campaignId) {
            void check();
          }
        });

        room.onReconnect(() => {
          void check();
        });

        room.onConnectionState((_connectionState: string) => {
          const isActive = rooms.size > 0 && Array.from(rooms.values()).some((r: any) => r.state === 'open');
          if (isActive !== anyRoomActive) {
            anyRoomActive = isActive;
            if (!isActive && !fallbackInterval) {
              fallbackInterval = setInterval(() => void check(), POLL_INTERVAL_MS);
            } else if (isActive && fallbackInterval) {
              clearInterval(fallbackInterval);
              fallbackInterval = null;
            }
          }
        });
      }
      anyRoomActive = true;
    } else {
      // Rooms unavailable, use polling only
      anyRoomActive = false;
    }

    void check();
    if (!anyRoomActive) {
      fallbackInterval = setInterval(() => void check(), POLL_INTERVAL_MS);
    }

    return () => {
      cancelled = true;
      for (const room of rooms.values()) {
        room.close();
      }
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignIds.join(','), app]);

  return activeCampaigns;
}

export function useCampaignTracking(campaignId: string | undefined) {
  const ids = campaignId ? [campaignId] : [];
  const activeCampaigns = useActiveCampaignTracking(ids);
  return campaignId ? activeCampaigns.has(campaignId) : false;
}
