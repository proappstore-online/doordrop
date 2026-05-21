export type PlanType = "roster" | "pooling";

export type userPayment = {
  plan: string,
  perMember: number,
  perService?: number,
  total: number,
}

export interface DeliveryScheduleRule {
  intervalWeeks: number;
  anchorDate: Date;
}

export type CampaignStatus = "draft" | "ready" | "assigned" | "complete" | "review" | "payment" | "archive";

export type CampaignData = {
  name: string; // Friendly display name (e.g., "Oak Ave 3150")
  streetName?: string;
  nameKey: string; // For uniqueness comparison (e.g., "xyz street parramatta 2150")
  suburb?: string;
  postcode?: string;
  country?: string;
  state?: string;
  planType: PlanType;
  adminIds: string[]; // User IDs who manage group
  createdAt: Date;
  updatedAt?: Date;
  memberIds?: string[]; // User IDs of members in group
  userPayment?: userPayment;
  assignedWalkerId?: string; // Currently committed walker
  scheduleRule?: DeliveryScheduleRule; // Schedule rule for roster groups
  totalDoors?: number;
  budget?: number;
  dueDate?: Date;
  jobStatus?: "draft" | "posted" | "assigned" | "in_progress" | "completed";
  status: CampaignStatus;
  completedAt?: Date;
  archivedAt?: Date;
  lat?: number;
  lng?: number;
  doorRadiusM?: number;
  junkMailPolicy?: "deliver" | "skip";
  propertyFilter?: "all" | "residential" | "commercial";
  businessCategories?: string[];
  activePrintoutId?: string;
};

export type TrackPoint = {
  lat: number;
  lng: number;
  t: number;
  speed?: number; // Speed in m/s at this point
};
export type TrackStop = { lat: number; lng: number; startTime: number; endTime: number };
export type TrackSession = {
  walkerId: string;
  startedAt: number;
  endedAt?: number;
  points: TrackPoint[];
  stops: TrackStop[];
};
