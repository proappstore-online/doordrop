import type { BookingData } from '../models/booking';
import { apiGet, apiPost } from '../lib/api';
import { fromWire, toWire } from '../lib/transform';

export const BookingRepository = {
  /** Books a walker; the server computes the price from the walker's rate and the campaign's member count. */
  async create(campaignId: string, data: { walkerId: string; date: Date; doorCount: number }): Promise<string> {
    const res = await apiPost<{ id: string }>(`/v1/campaigns/${encodeURIComponent(campaignId)}/bookings`, toWire(data));
    return res.id;
  },

  async listByCampaign(campaignId: string): Promise<BookingData[]> {
    const raw = await apiGet<unknown[]>(`/v1/campaigns/${encodeURIComponent(campaignId)}/bookings`);
    return raw.map((r) => fromWire<BookingData>(r));
  },
};
