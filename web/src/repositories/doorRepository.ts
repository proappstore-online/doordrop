import type { DoorData, DeliveryEvent } from '../models/door';
import { apiGet, apiPost, apiPatch, apiDelete } from '../lib/api';
import { fromWire, toWire } from '../lib/transform';

type DoorWithId = DoorData & { id: string };

export const DoorRepository = {
  async createDoors(campaignId: string, doors: DoorData[]): Promise<void> {
    // Chunked bulk insert; the worker handler runs them in a single D1 batch.
    const chunkSize = 200;
    for (let i = 0; i < doors.length; i += chunkSize) {
      const chunk = doors.slice(i, i + chunkSize);
      await apiPost(`/v1/campaigns/${campaignId}/doors/bulk`, {
        doors: chunk.map((d) => toWire(d)),
      });
    }
  },

  async getDoorsByCampaign(campaignId: string): Promise<DoorWithId[]> {
    const raw = await apiGet<unknown[]>(`/v1/campaigns/${campaignId}/doors`);
    return raw.map((r) => fromWire<DoorWithId>(r));
  },

  async addDoor(campaignId: string, door: DoorData): Promise<string> {
    const res = await apiPost<{ id: string }>(`/v1/campaigns/${campaignId}/doors`, toWire(door));
    return res.id;
  },

  async deleteDoor(campaignId: string, doorId: string): Promise<void> {
    await apiDelete(`/v1/campaigns/${campaignId}/doors/${doorId}`);
  },

  async updateDoor(campaignId: string, doorId: string, data: Partial<DoorData>): Promise<void> {
    await apiPatch(`/v1/campaigns/${campaignId}/doors/${doorId}`, toWire(data));
  },

  async recordDelivery(
    campaignId: string,
    doorId: string,
    event: DeliveryEvent,
  ): Promise<void> {
    // Read-modify-write — small concurrency risk; acceptable for a single
    // walker delivering one door at a time. PATCH endpoint enforces the
    // walker-allow-list (status/delivered_at/delivered_by/delivery_count/history).
    const doors = await this.getDoorsByCampaign(campaignId);
    const current = doors.find((d) => d.id === doorId);
    const newHistory = [...(current?.history ?? []), event];
    await apiPatch(`/v1/campaigns/${campaignId}/doors/${doorId}`, {
      status: 'delivered',
      delivered_at: event.date.getTime(),
      delivered_by: event.deliveredBy,
      delivery_count: (current?.deliveryCount ?? 0) + 1,
      history: newHistory.map((h) => toWire(h)),
    });
  },
};
