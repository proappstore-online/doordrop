export type CampaignStatus = 'draft' | 'ready' | 'assigned' | 'complete' | 'review' | 'payment' | 'archive';
export type ActorRole = 'campaign_admin' | 'assigned_walker' | 'platform_admin';

export type Transition = {
  from: CampaignStatus;
  to: CampaignStatus;
  allowedRoles: ActorRole[];
  description: string;
};

const TRANSITIONS: Transition[] = [
  // Campaign admin: can publish/unpublish and edit most fields
  { from: 'draft', to: 'ready', allowedRoles: ['campaign_admin'], description: 'Publish campaign' },
  { from: 'ready', to: 'draft', allowedRoles: ['campaign_admin'], description: 'Unpublish campaign' },
  // Campaign admin can also manually set assigned, but in practice this is done by platform admin
  { from: 'draft', to: 'assigned', allowedRoles: ['campaign_admin'], description: 'Assign walker' },
  { from: 'ready', to: 'assigned', allowedRoles: ['campaign_admin'], description: 'Assign walker' },

  // Platform admin: can transition through the full lifecycle
  { from: 'draft', to: 'ready', allowedRoles: ['platform_admin'], description: 'Publish campaign' },
  { from: 'ready', to: 'draft', allowedRoles: ['platform_admin'], description: 'Unpublish campaign' },
  { from: 'ready', to: 'assigned', allowedRoles: ['platform_admin'], description: 'Assign walker' },
  { from: 'assigned', to: 'complete', allowedRoles: ['platform_admin'], description: 'Mark delivery complete' },
  { from: 'complete', to: 'review', allowedRoles: ['platform_admin'], description: 'Initiate review' },
  { from: 'review', to: 'payment', allowedRoles: ['platform_admin'], description: 'Initiate payment' },
  { from: 'payment', to: 'archive', allowedRoles: ['platform_admin'], description: 'Archive campaign' },

  // Platform admin only: can archive from any state
  { from: 'draft', to: 'archive', allowedRoles: ['platform_admin'], description: 'Archive campaign' },
  { from: 'ready', to: 'archive', allowedRoles: ['platform_admin'], description: 'Archive campaign' },
  { from: 'assigned', to: 'archive', allowedRoles: ['platform_admin'], description: 'Archive campaign' },
  { from: 'complete', to: 'archive', allowedRoles: ['platform_admin'], description: 'Archive campaign' },
  { from: 'review', to: 'archive', allowedRoles: ['platform_admin'], description: 'Archive campaign' },
  { from: 'payment', to: 'archive', allowedRoles: ['platform_admin'], description: 'Archive campaign' },
];

export const TRANSITION_MAP = new Map<string, Transition[]>(
  TRANSITIONS.reduce(
    (acc, t) => {
      const key = `${t.from}->${t.to}`;
      if (!acc.has(key)) acc.set(key, []);
      acc.get(key)!.push(t);
      return acc;
    },
    new Map<string, Transition[]>()
  )
);

export function canTransition(from: CampaignStatus, to: CampaignStatus, actorRole: ActorRole): boolean {
  if (from === to) return true; // No-op transitions are always allowed
  const key = `${from}->${to}`;
  const transitions = TRANSITION_MAP.get(key);
  if (!transitions) return false;
  return transitions.some((t) => t.allowedRoles.includes(actorRole));
}

export function getTransitionError(from: CampaignStatus, to: CampaignStatus, actorRole: ActorRole): string | null {
  if (from === to) return null;
  const key = `${from}->${to}`;
  const transitions = TRANSITION_MAP.get(key);
  if (!transitions) {
    return `Cannot transition from ${from} to ${to}`;
  }
  if (!transitions.some((t) => t.allowedRoles.includes(actorRole))) {
    return `${actorRole} cannot transition from ${from} to ${to}`;
  }
  return null;
}

const DRAFT_FIELDS = new Set([
  'door_radius_m',
  'junk_mail_policy',
  'active_printout_id',
  'suburb',
  'postcode',
  'state',
  'country',
  'street_name',
  'lat',
  'lng',
  'property_filter',
  'business_categories',
]);

export function isFieldMutable(fieldName: string, currentStatus: CampaignStatus, actorRole: ActorRole): boolean {
  if (!DRAFT_FIELDS.has(fieldName)) return true;
  if (currentStatus === 'draft' || currentStatus === 'ready') return true;
  if (currentStatus === 'archive') return false;
  if (actorRole === 'platform_admin') return true;
  return false;
}

export function getNextActions(currentStatus: CampaignStatus, actorRole: ActorRole): CampaignStatus[] {
  return TRANSITIONS.filter((t) => t.from === currentStatus && t.allowedRoles.includes(actorRole)).map((t) => t.to);
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
