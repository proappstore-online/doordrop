// Polling port of the Firestore-onSnapshot original. A campaign is "actively
// tracking" if its latest track session has emitted a point in the last 30s.
// We poll the worker every 30s per campaign. Move to fas.rooms `track:{id}`
// in task #10 once the worker broadcasts on append.

import { useState, useEffect } from 'react';
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

  useEffect(() => {
    if (campaignIds.length === 0) {
      setActiveCampaigns(new Set());
      return;
    }
    let cancelled = false;

    const check = async () => {
      const results = await Promise.all(
        campaignIds.map(async (id) => [id, await hasRecentActivity(id)] as const),
      );
      if (cancelled) return;
      setActiveCampaigns(new Set(results.filter(([, active]) => active).map(([id]) => id)));
    };

    void check();
    const interval = setInterval(() => void check(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignIds.join(',')]);

  return activeCampaigns;
}

export function useCampaignTracking(campaignId: string | undefined) {
  const ids = campaignId ? [campaignId] : [];
  const activeCampaigns = useActiveCampaignTracking(ids);
  return campaignId ? activeCampaigns.has(campaignId) : false;
}
