import type { UserData, UserWithId } from '../models/user';
import { apiGet, apiPatch, apiDelete, apiPost, ApiError } from '../lib/api';
import { fromWire, toWire } from '../lib/transform';

export const UserRepository = {
  async getUser(userId: string): Promise<UserWithId | null> {
    try {
      const raw = await apiGet(`/v1/users/${encodeURIComponent(userId)}`);
      return fromWire<UserWithId>(raw);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  },

  async createUser(_userId: string, _data: UserData): Promise<void> {
    // User creation goes through POST /v1/me/role (first-time role pick).
    // This function previously also ran as part of ensureUserDocument on every
    // sign-in — we no longer do that; the role-picker page covers it. Calls
    // here are likely stale and would 404, so we surface that explicitly.
    throw new Error(
      'UserRepository.createUser: users are created via POST /v1/me/role at sign-in, ' +
        'not by callers. Use updateUser to mutate an existing row.',
    );
  },

  async updateUser(userId: string, data: Partial<UserData>): Promise<void> {
    await apiPatch(`/v1/users/${encodeURIComponent(userId)}`, toWire(data));
  },

  async deleteUser(userId: string): Promise<void> {
    await apiDelete(`/v1/users/${encodeURIComponent(userId)}`);
  },

  async getUsersByRole(role: string): Promise<UserWithId[]> {
    const raw = await apiGet<unknown[]>(`/v1/users?role=${encodeURIComponent(role)}`);
    return raw.map((r) => fromWire<UserWithId>(r));
  },

  async getUsersByCampaign(campaignId: string): Promise<UserWithId[]> {
    const raw = await apiGet<unknown[]>(`/v1/users?campaignId=${encodeURIComponent(campaignId)}`);
    return raw.map((r) => fromWire<UserWithId>(r));
  },

  async getUsersInSameArea(currentUser: UserWithId): Promise<UserWithId[]> {
    const q = new URLSearchParams({
      street: currentUser.street?.trim() ?? '',
      suburb: currentUser.suburb?.trim() ?? '',
      location: currentUser.location?.trim() ?? '',
      postcode: currentUser.postcode?.trim() ?? '',
    }).toString();
    const raw = await apiGet<unknown[]>(`/v1/users?${q}`);
    const users = raw.map((r) => fromWire<UserWithId>(r));
    return users.filter((u) => u.id !== currentUser.id && !u.campaignId);
  },

  async incrementWalkerStats(
    userId: string,
    stats: {
      campaignsCompleted?: number;
      doorsDelivered?: number;
      kmWalked?: number;
      minutesSpent?: number;
    },
  ): Promise<void> {
    await apiPost(`/v1/users/${encodeURIComponent(userId)}/walker-stats/increment`, stats);
  },

  async getUserImage(userId: string): Promise<string | null> {
    const u = await this.getUser(userId);
    return u?.photoURL ?? null;
  },
};
