import { apiGet, apiPost } from '../lib/api';
import { fromWire } from '../lib/transform';

export interface CampaignNote {
  id: string;
  text: string;
  userName: string;
  userId: string;
  createdAt: Date;
}

export const CampaignNoteRepository = {
  async addNote(
    campaignId: string,
    text: string,
    userName: string,
    _userId: string,
  ): Promise<string> {
    // userId is taken from the auth bearer server-side; argument kept for caller compat.
    const res = await apiPost<{ id: string; createdAt: number }>(
      `/v1/campaigns/${campaignId}/notes`,
      { text: text.slice(0, 5000), userName },
    );
    return res.id;
  },

  // TODO(task #10): port to fas.rooms `chat:{campaignId}`. Polling stub for now.
  subscribeToNotes(campaignId: string, callback: (notes: CampaignNote[]) => void): () => void {
    let active = true;
    let lastSince = 0;
    const accum: CampaignNote[] = [];

    const tick = async () => {
      if (!active) return;
      try {
        const raw = await apiGet<unknown[]>(
          `/v1/campaigns/${campaignId}/notes${lastSince ? `?since=${lastSince}` : ''}`,
        );
        const fresh = raw.map((r) => fromWire<CampaignNote>(r));
        if (fresh.length > 0) {
          for (const n of fresh) accum.push(n);
          lastSince = Math.max(...fresh.map((n) => n.createdAt.getTime()));
          callback([...accum]);
        }
      } catch {
        /* swallow — next tick retries */
      }
      if (active) setTimeout(tick, 3000);
    };

    void tick();
    return () => {
      active = false;
    };
  },
};
