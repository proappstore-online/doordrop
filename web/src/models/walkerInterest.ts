export type WalkerInterestStatus = 'pending' | 'withdrawn' | 'assigned';

export type WalkerInterest = {
  id?: string;
  walkerId: string;
  campaignId: string;
  status: WalkerInterestStatus;
  createdAt: Date;
  updatedAt?: Date;
};
