import type { CampaignStatus, DoorData, UserWithId } from '../models';
import { apiGet, apiPost } from '../lib/api';
import { fromWire } from '../lib/transform';

export type JobStatus = 'draft' | 'posted' | 'assigned' | 'in_progress' | 'completed';
export type AdminStats = { users: number; walkers: number; campaigns: number };
export type AdminDoor = DoorData & { id: string; campaignId: string; campaignName: string; suburb?: string };

export const AdminRepository = {
  async getStats(): Promise<AdminStats> {
    return fromWire<AdminStats>(await apiGet('/v1/admin/stats'));
  },

  async getAllUsers(): Promise<UserWithId[]> {
    const raw = await apiGet<unknown[]>('/v1/users');
    return raw.map((r) => fromWire<UserWithId>(r));
  },

  async setUserRole(userId: string, role: UserWithId['role']): Promise<void> {
    await apiPost(`/v1/admin/users/${encodeURIComponent(userId)}/role`, { role });
  },

  async getAllDoors(): Promise<AdminDoor[]> {
    const raw = await apiGet<unknown[]>('/v1/admin/doors');
    return raw.map((r) => fromWire<AdminDoor>(r));
  },

  async setCampaignStatus(
    campaignId: string,
    update: { status?: CampaignStatus; job_status?: JobStatus },
  ): Promise<void> {
    await apiPost(`/v1/admin/campaigns/${encodeURIComponent(campaignId)}/status`, update);
  },
};
