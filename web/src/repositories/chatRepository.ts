import { apiGet, apiPost, apiPut, ApiError } from '../lib/api';
import { fromWire } from '../lib/transform';
import { CampaignNoteRepository, type CampaignNote } from './campaignNoteRepository';
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

  subscribeToMessages(campaignId: string, callback: (notes: CampaignNote[]) => void): () => void {
    return CampaignNoteRepository.subscribeToNotes(campaignId, callback);
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
