import type { WalkerReview } from '../models/walkerReview';
import { apiGet, apiPost } from '../lib/api';
import { fromWire, toWire } from '../lib/transform';

type ReviewWithId = WalkerReview & { id: string };

// PaginationCursor replaces the original Firestore `QueryDocumentSnapshot`
// last-doc handle. We just use an offset; pages can stash it the same way.
export interface PaginationCursor {
  offset: number;
}

export const WalkerReviewRepository = {
  async createReview(walkerId: string, data: WalkerReview): Promise<string> {
    const res = await apiPost<{ id: string }>(
      `/v1/walkers/${encodeURIComponent(walkerId)}/reviews`,
      toWire({ ...data, createdAt: data.createdAt ?? new Date() }),
    );
    return res.id;
  },

  async getReview(walkerId: string, reviewId: string): Promise<ReviewWithId | null> {
    const all = await this.getReviewsForWalker(walkerId, 500);
    return all.reviews.find((r) => r.id === reviewId) ?? null;
  },

  async getReviewByScheduleAndReviewer(
    walkerId: string,
    scheduleId: string,
    reviewerId: string,
  ): Promise<ReviewWithId | null> {
    const all = await this.getReviewsForWalker(walkerId, 500);
    return (
      all.reviews.find((r) => r.scheduleId === scheduleId && r.reviewerId === reviewerId) ?? null
    );
  },

  async getReviewsForWalker(
    walkerId: string,
    pageSize = 10,
    lastDoc?: PaginationCursor,
  ): Promise<{ reviews: ReviewWithId[]; lastDoc?: PaginationCursor }> {
    // Worker returns all reviews (limited to 500); we paginate client-side.
    const raw = await apiGet<unknown[]>(`/v1/walkers/${encodeURIComponent(walkerId)}/reviews`);
    const all = raw.map((r) => fromWire<ReviewWithId>(r));
    const start = lastDoc?.offset ?? 0;
    const page = all.slice(start, start + pageSize);
    const nextOffset = start + page.length;
    return {
      reviews: page,
      lastDoc: nextOffset < all.length ? { offset: nextOffset } : undefined,
    };
  },

  async getReviewStats(walkerId: string): Promise<{ average: number; count: number }> {
    const all = await this.getReviewsForWalker(walkerId, 500);
    const reviews = all.reviews;
    if (reviews.length === 0) return { average: 0, count: 0 };
    const total = reviews.reduce((s, r) => s + r.rating, 0);
    return { average: total / reviews.length, count: reviews.length };
  },
};
