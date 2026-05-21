import type { WalkerInterest } from '../models/walkerInterest';
import { apiGet, apiPost, ApiError } from '../lib/api';
import { fromWire } from '../lib/transform';

type InterestWithId = WalkerInterest & { id: string };

export const WalkerInterestRepository = {
  async createInterest(data: WalkerInterest): Promise<string> {
    // walker_id is taken from the auth bearer; campaignId is the input.
    try {
      const res = await apiPost<{ id: string }>('/v1/interests', { campaignId: data.campaignId });
      return res.id;
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        // Already interested — find the existing row.
        const existing = await this.getInterestByWalkerAndGroup(data.walkerId, data.campaignId);
        if (existing) return existing.id;
      }
      throw e;
    }
  },

  async getInterestByWalkerAndGroup(
    walkerId: string,
    campaignId: string,
  ): Promise<InterestWithId | null> {
    const q = `walkerId=${encodeURIComponent(walkerId)}&campaignId=${encodeURIComponent(campaignId)}`;
    const raw = await apiGet<unknown[]>(`/v1/interests?${q}`);
    const arr = raw.map((r) => fromWire<InterestWithId>(r));
    return arr[0] ?? null;
  },

  async getInterestsByCampaign(campaignId: string): Promise<InterestWithId[]> {
    const raw = await apiGet<unknown[]>(`/v1/interests?campaignId=${encodeURIComponent(campaignId)}`);
    return raw.map((r) => fromWire<InterestWithId>(r));
  },

  async getInterestsByWalker(walkerId: string): Promise<InterestWithId[]> {
    const raw = await apiGet<unknown[]>(`/v1/interests?walkerId=${encodeURIComponent(walkerId)}`);
    return raw.map((r) => fromWire<InterestWithId>(r));
  },

  // The votes subcollection on walkerInterests was a half-built feature in the
  // original codebase with no model definition; the port plan dropped it.
  // Methods kept to preserve the caller surface but throw to surface stale callers.
  async castVote(_interestId: string, _userId: string): Promise<void> {
    throw new Error('WalkerInterestRepository.castVote: votes feature was dropped in the PAS port');
  },

  async hasUserVoted(_interestId: string, _userId: string): Promise<boolean> {
    return false;
  },

  async getVoteCount(_interestId: string): Promise<number> {
    return 0;
  },
};
