import type { DeliveryRunData } from '../models/deliveryRun';
import { apiGet, apiPost, ApiError } from '../lib/api';
import { fromWire } from '../lib/transform';

type DeliveryRunWithId = DeliveryRunData & { id: string };

export const DeliveryRunRepository = {
  async getSchedule(id: string): Promise<DeliveryRunWithId | null> {
    try {
      const raw = await apiGet<unknown>(`/v1/delivery-runs/${encodeURIComponent(id)}`);
      return fromWire<DeliveryRunWithId>(raw);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  },

  async createSchedule(data: DeliveryRunData, campaignId: string): Promise<string> {
    const res = await apiPost<{ id: string }>(
      `/v1/campaigns/${encodeURIComponent(campaignId)}/delivery-runs`,
      { date: data.date.getTime(), status: data.status, walkerId: data.walkerId },
    );
    return res.id;
  },

  async getSchedulesByCampaign(campaignId: string): Promise<DeliveryRunWithId[]> {
    const raw = await apiGet<unknown[]>(`/v1/campaigns/${encodeURIComponent(campaignId)}/delivery-runs`);
    return raw.map((r) => fromWire<DeliveryRunWithId>(r));
  },
};
