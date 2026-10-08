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
  assignedWalkerId?: string | null; // Currently committed walker
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

export function isCampaignEditable(status: CampaignStatus): boolean {
  return status === 'draft' || status === 'ready';
}

export function isCampaignClosed(status: CampaignStatus): boolean {
  return status === 'archive' || status === 'complete' || status === 'review' || status === 'payment';
}

export function getCampaignStatusLabel(status: CampaignStatus): string {
  const labels: Record<CampaignStatus, string> = {
    draft: 'Draft',
    ready: 'Published',
    assigned: 'Assigned',
    complete: 'Completed',
    review: 'In Review',
    payment: 'Payment Pending',
    archive: 'Archived',
  };
  return labels[status];
}

export function getCampaignStatusBadgeColor(status: CampaignStatus): string {
  const colors: Record<CampaignStatus, string> = {
    draft: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100',
    ready: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    assigned: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    complete: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
    review: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    payment: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    archive: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100',
  };
  return colors[status];
}

export type ActorRole = 'campaign_admin' | 'assigned_walker' | 'platform_admin';

export function getNextActions(currentStatus: CampaignStatus, actorRole: ActorRole): CampaignStatus[] {
  // Campaign admin transitions
  if (actorRole === 'campaign_admin') {
    switch (currentStatus) {
      case 'draft':
        return ['ready', 'assigned'];
      case 'ready':
        return ['draft', 'assigned'];
      default:
        return [];
    }
  }

  // Platform admin can do more transitions
  if (actorRole === 'platform_admin') {
    switch (currentStatus) {
      case 'draft':
        return ['ready', 'assigned', 'archive'];
      case 'ready':
        return ['draft', 'assigned', 'archive'];
      case 'assigned':
        return ['complete', 'archive'];
      case 'complete':
        return ['review', 'archive'];
      case 'review':
        return ['payment', 'archive'];
      case 'payment':
        return ['archive'];
      default:
        return [];
    }
  }

  // Assigned walker can't transition
  return [];
}
