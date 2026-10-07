export type BookingData = {
  id: string;
  campaignId: string;
  walkerId: string;
  walkerName?: string;
  clientId: string;
  date: Date;
  doorCount: number;
  ratePerDoor: number;
  totalPrice: number;
  pricePerMember: number;
  memberCount: number;
  status: string;
  createdAt: Date;
};
