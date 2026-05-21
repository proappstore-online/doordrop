import type { FlyerData } from '../models/flyer';
import { apiGet, apiPost, apiPatch, apiDelete } from '../lib/api';
import { fromWire, toWire } from '../lib/transform';

type FlyerWithId = FlyerData & { id: string };

export const FlyerRepository = {
  async getFlyers(userId: string): Promise<FlyerWithId[]> {
    const raw = await apiGet<unknown[]>(`/v1/users/${encodeURIComponent(userId)}/flyers`);
    return raw.map((r) => fromWire<FlyerWithId>(r));
  },

  async createFlyer(userId: string, data: FlyerData): Promise<string> {
    const res = await apiPost<{ id: string }>(
      `/v1/users/${encodeURIComponent(userId)}/flyers`,
      toWire(data),
    );
    return res.id;
  },

  async updateFlyer(
    userId: string,
    flyerId: string,
    data: Partial<Pick<FlyerData, 'name' | 'description' | 'fileUrl'>>,
  ): Promise<void> {
    await apiPatch(
      `/v1/users/${encodeURIComponent(userId)}/flyers/${flyerId}`,
      toWire(data),
    );
  },

  async deleteFlyer(userId: string, flyerId: string): Promise<void> {
    await apiDelete(`/v1/users/${encodeURIComponent(userId)}/flyers/${flyerId}`);
  },
};
