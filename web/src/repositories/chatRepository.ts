import { apiGet, apiPost, apiPut, ApiError } from '../lib/api';
import { fromWire } from '../lib/transform';
import type { CampaignNote } from './campaignNoteRepository';
import type { ChatReadState } from '../models/chatReadState';

export const ChatRepository = {
  async sendMessage(
    campaignId: string,
    text: string,
    userName: string,
    _userId: string,
  ): Promise<{ id: string; createdAt: number }> {
    return apiPost(`/v1/campaigns/${campaignId}/notes`, {
      text: text.slice(0, 5000),
      userName,
    });
  },

  // TODO(task #10): port to fas.rooms `chat:{campaignId}` for true real-time.
  subscribeToMessages(campaignId: string, callback: (notes: CampaignNote[]) => void): () => void {
    let active = true;
    let lastTs = 0;
    const accum: CampaignNote[] = [];

    const tick = async () => {
      if (!active) return;
      try {
        const raw = await apiGet<unknown[]>(
          `/v1/campaigns/${campaignId}/notes${lastTs ? `?since=${lastTs}` : ''}`,
        );
        const fresh = raw.map((r) => fromWire<CampaignNote>(r));
        if (fresh.length > 0) {
          for (const n of fresh) accum.push(n);
          lastTs = Math.max(...fresh.map((n) => n.createdAt.getTime()));
          callback([...accum]);
        }
      } catch {
        /* swallow */
      }
      if (active) setTimeout(tick, 3000);
    };

    void tick();
    return () => {
      active = false;
    };
  },

  async getLatestMessage(campaignId: string): Promise<CampaignNote | null> {
    try {
      const raw = await apiGet<unknown[]>(`/v1/campaigns/${campaignId}/notes`);
      if (raw.length === 0) return null;
      const arr = raw.map((r) => fromWire<CampaignNote>(r));
      return arr[arr.length - 1] ?? null;
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) return null;
      throw e;
    }
  },

  // TODO(task #11): poll for now; could be a per-user room subscription later.
  subscribeToReadStates(
    userId: string,
    callback: (states: Record<string, ChatReadState>) => void,
  ): () => void {
    let active = true;
    const tick = async () => {
      if (!active) return;
      try {
        const states = await apiGet<Record<string, { lastReadAt: number }>>(
          `/v1/users/${encodeURIComponent(userId)}/chat-read-state`,
        );
        const out: Record<string, ChatReadState> = {};
        for (const [k, v] of Object.entries(states)) {
          out[k] = { lastReadAt: new Date(v.lastReadAt) };
        }
        callback(out);
      } catch {
        /* swallow */
      }
      if (active) setTimeout(tick, 5000);
    };
    void tick();
    return () => {
      active = false;
    };
  },

  async markAsRead(userId: string, campaignId: string): Promise<void> {
    await apiPut(
      `/v1/users/${encodeURIComponent(userId)}/chat-read-state/${encodeURIComponent(campaignId)}`,
    );
  },
};
