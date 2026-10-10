import { apiGet, apiPost } from '../lib/api';
import { fromWire } from '../lib/transform';
import { pas } from '../services/pas';
import type { RoomEvent } from '@proappstore/sdk';

export interface CampaignNote {
  id: string;
  text: string;
  userName: string;
  userId: string;
  createdAt: Date;
}

type CampaignRoomEvent = {
  type?: string;
  campaignId?: string;
  noteId?: string;
  createdAt?: number;
};

/**
 * Fetch the durable note history, then use the campaign's room only as an
 * invalidation signal. Room events are intentionally not the source of truth:
 * they are ephemeral and can be missed while a client reconnects.
 */
function subscribeToCampaignNotes(
  campaignId: string,
  callback: (notes: CampaignNote[]) => void,
): () => void {
  let active = true;
  let lastSince = 0;
  let fetching = false;
  let refreshQueued = false;
  let lastEventSequence: number | null = null;
  const accum: CampaignNote[] = [];

  const refresh = async () => {
    if (!active || fetching) {
      refreshQueued = true;
      return;
    }
    fetching = true;
    try {
      const raw = await apiGet<unknown[]>(
        `/v1/campaigns/${campaignId}/notes${lastSince ? `?since=${lastSince}` : ''}`,
      );
      const fresh = raw.map((r) => fromWire<CampaignNote>(r));
      if (fresh.length > 0) {
        accum.push(...fresh);
        lastSince = Math.max(lastSince, ...fresh.map((n) => n.createdAt.getTime()));
      }
      callback([...accum]);
    } catch {
      // A later room event or reconnect will retry; events are not persisted.
    } finally {
      fetching = false;
      if (active && refreshQueued) {
        refreshQueued = false;
        void refresh();
      }
    }
  };

  const room = pas.rooms.join(`campaign:${campaignId}`);
  const unsubscribeEvent = room.onEvent<CampaignRoomEvent>((event: RoomEvent<CampaignRoomEvent>) => {
    if (event.data.type !== 'note.created' || event.data.campaignId !== campaignId) return;
    // A sequence gap means an event was missed. In either case, refetch the
    // durable D1 history rather than trusting the event payload itself.
    const missedEvent = lastEventSequence !== null && event.seq !== lastEventSequence + 1;
    lastEventSequence = event.seq;
    if (missedEvent) {
      // Start from the authoritative full history after a gap; a delta cursor
      // cannot prove it contains every missed write.
      lastSince = 0;
      accum.length = 0;
    }
    void refresh();
  });
  const unsubscribeReconnect = room.onReconnect(() => {
    lastEventSequence = null;
    void refresh();
  });

  void refresh();
  return () => {
    active = false;
    unsubscribeEvent();
    unsubscribeReconnect();
    room.close();
  };
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

  subscribeToNotes(campaignId: string, callback: (notes: CampaignNote[]) => void): () => void {
    return subscribeToCampaignNotes(campaignId, callback);
  },
};
