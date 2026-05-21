import type { CampaignData } from '../models/campaign';
import type { UserData } from '../models/user';
import { apiGet, apiPost, apiPatch, apiDelete, ApiError } from '../lib/api';
import { fromWire, toWire } from '../lib/transform';

type CampaignWithId = CampaignData & { id: string };

export const CampaignRepository = {
  async getGroup(groupId: string): Promise<CampaignWithId | null> {
    try {
      const raw = await apiGet(`/v1/campaigns/${groupId}`);
      return fromWire<CampaignWithId>(raw);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  },

  async createGroup(data: CampaignData): Promise<string> {
    const res = await apiPost<{ id: string }>('/v1/campaigns', toWire(data));
    return res.id;
  },

  async updateGroup(groupId: string, data: Partial<CampaignData>): Promise<void> {
    await apiPatch(`/v1/campaigns/${groupId}`, toWire(data));
  },

  async deleteGroup(groupId: string): Promise<void> {
    await apiDelete(`/v1/campaigns/${groupId}`);
  },

  async getCampaignsByUser(userId: string): Promise<CampaignWithId[]> {
    const raw = await apiGet<unknown[]>(`/v1/campaigns?adminId=${encodeURIComponent(userId)}`);
    return raw.map((r) => fromWire<CampaignWithId>(r));
  },

  async getActiveCampaigns(): Promise<CampaignWithId[]> {
    const raw = await apiGet<unknown[]>('/v1/campaigns?status=ready,assigned');
    return raw.map((r) => fromWire<CampaignWithId>(r));
  },

  async getAllGroups(): Promise<CampaignWithId[]> {
    const raw = await apiGet<unknown[]>('/v1/campaigns');
    return raw.map((r) => fromWire<CampaignWithId>(r));
  },

  async getUserPayment(groupId: string): Promise<CampaignData['userPayment'] | null> {
    const group = await this.getGroup(groupId);
    return group?.userPayment ?? null;
  },

  async getCampaignsByAssignedWalker(walkerId: string): Promise<CampaignWithId[]> {
    const raw = await apiGet<unknown[]>(`/v1/campaigns?walkerId=${encodeURIComponent(walkerId)}`);
    return raw.map((r) => fromWire<CampaignWithId>(r));
  },

  async getGroupsByName(suburb: string, postcode: string): Promise<CampaignWithId[]> {
    const q = `suburb=${encodeURIComponent(suburb.trim().toLowerCase())}&postcode=${encodeURIComponent(postcode.trim())}`;
    const raw = await apiGet<unknown[]>(`/v1/campaigns?${q}`);
    return raw.map((r) => fromWire<CampaignWithId>(r));
  },

  async getGroupWithMembers(
    groupId?: string,
  ): Promise<{ group: CampaignWithId | null; members: (UserData & { id: string })[] }> {
    if (!groupId) return { group: null, members: [] };
    const group = await this.getGroup(groupId);
    if (!group) return { group: null, members: [] };
    const rawMembers = await apiGet<unknown[]>(`/v1/users?campaignId=${encodeURIComponent(groupId)}`);
    return { group, members: rawMembers.map((r) => fromWire<UserData & { id: string }>(r)) };
  },
};
