export type WalkerReview = {
  id?: string;
  walkerId: string;
  reviewerId: string;
  reviewerName?: string;
  campaignId: string;
  scheduleId?: string;
  rating: number;
  comment?: string;
  createdAt: Date;
  updatedAt?: Date;
};
