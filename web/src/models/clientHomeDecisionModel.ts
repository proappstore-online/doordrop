/**
 * Client Home Decision Model (Issue #44)
 *
 * This is the source of truth for how campaigns are presented in the client portfolio.
 * It defines:
 * - Campaign states and attention flags
 * - Priority/sorting rules
 * - Card content for each state (mobile and desktop)
 * - Empty/loading/error state handling
 *
 * Used by ClientDashboard and campaign cards to render without inferring logic
 * from scattered components.
 */

import type { CampaignStatus, CampaignData } from "./campaign";

/**
 * Attention flags: indicate a campaign needs the client's action or awareness.
 */
export const AttentionFlag = {
  NO_FLYER: "no_flyer" as const,
  NO_DELIVERY_AREA: "no_delivery_area" as const,
  PAST_DUE: "past_due" as const,
  AWAITING_APPROVAL: "awaiting_approval" as const,
  WALKER_NEEDED: "walker_needed" as const,
  NO_DELIVERY_PROGRESS: "no_delivery_progress" as const,
} as const;

export type AttentionFlag = typeof AttentionFlag[keyof typeof AttentionFlag];

/**
 * Portfolio sections: how campaigns are grouped in the home view.
 */
export const PortfolioSection = {
  ACTIVE: "active" as const,
  DRAFT: "draft" as const,
  ATTENTION_NEEDED: "attention_needed" as const,
  COMPLETED: "completed" as const,
  BLOCKED: "blocked" as const,
} as const;

export type PortfolioSection = typeof PortfolioSection[keyof typeof PortfolioSection];

/**
 * Campaign presentation: what to show on a campaign card.
 * Defines required and optional fields for both mobile and desktop layouts.
 */
export interface CampaignCardContent {
  /** Primary identifier and navigation target */
  campaignId: string;
  campaignName: string;

  /** Status badge and color (always shown) */
  status: CampaignStatus;
  statusLabel: string;
  statusColor: string;

  /** Location (mobile: single line, desktop: multiline) */
  location: string; // "Suburb, Postcode" for mobile, "Street · Suburb Postcode" for desktop
  suburb?: string;
  postcode?: string;
  streetName?: string;

  /** Progress indicators (desktop primary, mobile secondary) */
  doorCount?: number; // "150 doors"
  budget?: number; // "$1,500 budget"
  dueDate?: Date; // "Due Nov 15"

  /** Attention badge (shown if any attention flag is present) */
  attentionFlags: AttentionFlag[];
  primaryAttention?: AttentionFlag; // Most urgent flag to show

  /** Flyer status (shown on desktop, optional on mobile) */
  flyerName?: string;
  hasFlyerSelected: boolean;

  /** Walker status (shown on desktop, hidden on mobile) */
  walkerName?: string;
  hasWalkerAssigned: boolean;

  /** Delivery progress (shown on assigned campaigns) */
  deliveredCount?: number; // "125/150 doors delivered"
  deliveryPercentage?: number; // For progress bar

  /** Call-to-action for card */
  primaryAction: {
    label: string;
    href: string;
    variant: "default" | "attention"; // "attention" for red/urgent styling
  };

  /** Timeline metadata (internal, used for sorting) */
  createdAt: Date;
  updatedAt?: Date;
  completedAt?: Date;
}

/**
 * Determines which portfolio section a campaign belongs to.
 * Sections are mutually exclusive and prioritized in this order.
 */
export function getCampaignSection(
  campaign: CampaignData & { id: string },
): typeof PortfolioSection[keyof typeof PortfolioSection] {
  const flags = getAttentionFlags(campaign);

  // Blocked: campaigns that can't proceed
  if (campaign.status === "draft" && flags.includes(AttentionFlag.NO_DELIVERY_AREA)) {
    return PortfolioSection.BLOCKED;
  }

  // Attention needed: campaigns waiting for client action
  if (
    flags.includes(AttentionFlag.AWAITING_APPROVAL) ||
    (campaign.status === "draft" && flags.includes(AttentionFlag.NO_FLYER))
  ) {
    return PortfolioSection.ATTENTION_NEEDED;
  }

  // Draft: campaigns being prepared
  if (campaign.status === "draft") {
    return PortfolioSection.DRAFT;
  }

  // Active: ready + assigned (in motion)
  if (["ready", "assigned"].includes(campaign.status)) {
    return PortfolioSection.ACTIVE;
  }

  // Completed: complete + review + payment + archive
  if (["complete", "review", "payment", "archive"].includes(campaign.status)) {
    return PortfolioSection.COMPLETED;
  }

  return PortfolioSection.DRAFT;
}

/**
 * Computes attention flags for a campaign.
 * Multiple flags can be present; use primaryAttentionFlag() to find the most urgent.
 */
export function getAttentionFlags(campaign: CampaignData & { id: string }): AttentionFlag[] {
  const flags: AttentionFlag[] = [];

  // Missing critical setup (draft only)
  if (campaign.status === "draft") {
    if (!campaign.activePrintoutId) {
      flags.push(AttentionFlag.NO_FLYER);
    }
    if (!campaign.lat || !campaign.lng) {
      flags.push(AttentionFlag.NO_DELIVERY_AREA);
    }
  }

  // Past due date
  if (campaign.dueDate && new Date(campaign.dueDate) < new Date()) {
    flags.push(AttentionFlag.PAST_DUE);
  }

  // Awaiting approval (in review/payment)
  if (["review", "payment"].includes(campaign.status)) {
    flags.push(AttentionFlag.AWAITING_APPROVAL);
  }

  // Ready but no walker assigned
  if (campaign.status === "ready" && !campaign.assignedWalkerId) {
    flags.push(AttentionFlag.WALKER_NEEDED);
  }

  return flags;
}

/**
 * Returns the primary (most urgent) attention flag for a campaign.
 * Used to determine the badge color and tooltip on the card.
 */
export function getPrimaryAttentionFlag(campaign: CampaignData & { id: string }): AttentionFlag | null {
  const flags = getAttentionFlags(campaign);
  if (flags.length === 0) return null;

  // Priority order (most urgent first)
  const priorityOrder = [
    AttentionFlag.NO_DELIVERY_AREA, // Can't proceed without it
    AttentionFlag.AWAITING_APPROVAL, // Waiting on client
    AttentionFlag.NO_FLYER, // Can't publish
    AttentionFlag.PAST_DUE, // Timeline issue
    AttentionFlag.WALKER_NEEDED, // Can't deliver
    AttentionFlag.NO_DELIVERY_PROGRESS, // Stalled delivery
  ];

  for (const flag of priorityOrder) {
    if (flags.includes(flag)) {
      return flag;
    }
  }

  return flags[0] ?? null;
}

/**
 * Returns a human-readable label for an attention flag.
 */
export function getAttentionFlagLabel(flag: AttentionFlag): string {
  const labels: Record<AttentionFlag, string> = {
    no_flyer: "No flyer selected",
    no_delivery_area: "Missing delivery area",
    past_due: "Past due",
    awaiting_approval: "Awaiting your review",
    walker_needed: "Looking for a walker",
    no_delivery_progress: "Delivery hasn't started",
  };
  return labels[flag];
}

/**
 * Returns a human-readable description for an attention flag.
 */
export function getAttentionFlagDescription(flag: AttentionFlag): string {
  const descriptions: Record<AttentionFlag, string> = {
    no_flyer: "Select or upload a flyer before publishing",
    no_delivery_area: "Define the delivery area to continue",
    past_due: "This campaign has passed its due date",
    awaiting_approval: "Review and approve the completion details",
    walker_needed: "Walkers have expressed interest; assign one to begin delivery",
    no_delivery_progress: "Expected delivery to have started by now",
  };
  return descriptions[flag];
}

/**
 * Sorting/priority for campaigns within a section.
 * More recently updated campaigns appear first within each section.
 */
export function sortCampaigns(campaigns: (CampaignData & { id: string })[]): (CampaignData & { id: string })[] {
  return [...campaigns].sort((a, b) => {
    const aTime = a.updatedAt?.getTime() ?? a.createdAt?.getTime() ?? 0;
    const bTime = b.updatedAt?.getTime() ?? b.createdAt?.getTime() ?? 0;
    return bTime - aTime;
  });
}

/**
 * Container state for the portfolio view.
 */
export const PortfolioLoadingState = {
  LOADING: "loading" as const,
  ERROR: "error" as const,
  EMPTY_FIRST_TIME: "empty_first_time" as const,
  EMPTY_ACTIVE_ONLY: "empty_active_only" as const,
  EMPTY_ALL: "empty_all" as const,
  READY: "ready" as const,
} as const;

export type PortfolioLoadingState = typeof PortfolioLoadingState[keyof typeof PortfolioLoadingState];

/**
 * Portfolio state: determines which view to render.
 */
export interface PortfolioState {
  loadingState: typeof PortfolioLoadingState[keyof typeof PortfolioLoadingState];
  sections: Partial<Record<typeof PortfolioSection[keyof typeof PortfolioSection], (CampaignData & { id: string })[]>>;
  totalCampaigns: number;
  error?: string;
}

/**
 * Computes portfolio state from a list of campaigns.
 */
export function computePortfolioState(
  campaigns: (CampaignData & { id: string })[] | null,
  loading: boolean,
  error: Error | null,
): PortfolioState {
  const sections: Record<PortfolioSection, (CampaignData & { id: string })[]> = {
    [PortfolioSection.ACTIVE]: [],
    [PortfolioSection.DRAFT]: [],
    [PortfolioSection.ATTENTION_NEEDED]: [],
    [PortfolioSection.COMPLETED]: [],
    [PortfolioSection.BLOCKED]: [],
  };

  if (loading) {
    return {
      loadingState: PortfolioLoadingState.LOADING,
      sections,
      totalCampaigns: 0,
    };
  }

  if (error) {
    return {
      loadingState: PortfolioLoadingState.ERROR,
      sections,
      totalCampaigns: campaigns?.length ?? 0,
      error: error.message,
    };
  }

  if (!campaigns || campaigns.length === 0) {
    return {
      loadingState: PortfolioLoadingState.EMPTY_FIRST_TIME,
      sections,
      totalCampaigns: 0,
    };
  }

  // Distribute campaigns into sections
  for (const campaign of campaigns) {
    const section = getCampaignSection(campaign);
    sections[section].push(campaign);
  }

  // Sort within each section
  for (const section of Object.values(sections)) {
    sortCampaigns(section);
  }

  // Determine if we're in an "empty active" state
  const hasActiveCampaigns =
    sections[PortfolioSection.ACTIVE].length > 0 ||
    sections[PortfolioSection.DRAFT].length > 0 ||
    sections[PortfolioSection.ATTENTION_NEEDED].length > 0;

  const loadingState = hasActiveCampaigns ? PortfolioLoadingState.READY : PortfolioLoadingState.EMPTY_ACTIVE_ONLY;

  return {
    loadingState,
    sections,
    totalCampaigns: campaigns.length,
  };
}

/**
 * Responsive layout guidance for campaign cards.
 * Defines which fields are shown on mobile vs desktop.
 */
export interface ResponsiveCardLayout {
  mobile: {
    // Always shown
    campaignName: true;
    location: true;
    status: true;
    attentionBadge: true;
    primaryAction: true;

    // Hidden on mobile, shown on hover/expanded
    flyerName: boolean; // Show in modal or drawer
    walkerName: boolean; // Show in modal or drawer
    doorCount: boolean; // Show if relevant (< 2 lines)
    budget: boolean; // Show if relevant
    dueDate: boolean; // Show if relevant
    deliveryProgress: boolean; // Hidden on mobile
  };

  desktop: {
    // Always shown
    campaignName: true;
    location: true;
    status: true;
    attentionBadge: true;
    primaryAction: true;

    // Desktop additional fields
    flyerName: true;
    walkerName: true;
    doorCount: true;
    budget: true;
    dueDate: true;
    deliveryProgress: true;
  };
}

export const RESPONSIVE_LAYOUT: ResponsiveCardLayout = {
  mobile: {
    campaignName: true,
    location: true,
    status: true,
    attentionBadge: true,
    primaryAction: true,
    flyerName: false,
    walkerName: false,
    doorCount: false,
    budget: false,
    dueDate: false,
    deliveryProgress: false,
  },
  desktop: {
    campaignName: true,
    location: true,
    status: true,
    attentionBadge: true,
    primaryAction: true,
    flyerName: true,
    walkerName: true,
    doorCount: true,
    budget: true,
    dueDate: true,
    deliveryProgress: true,
  },
};

/**
 * Accessibility guidance for portfolio view.
 */
export const A11Y_REQUIREMENTS = {
  // Portfolio container
  containerRole: "main",
  containerAriaLabel: "Campaign portfolio",

  // Section headings
  sectionHeadingLevel: "h2" as const,
  sectionHeadingAriaLabel: (section: PortfolioSection, count: number) =>
    `${section} campaigns (${count})`,

  // Campaign cards
  cardRole: "article",
  cardAriaLabel: (campaign: CampaignData & { id: string }) =>
    `${campaign.name}, ${campaign.status}${campaign.suburb ? `, ${campaign.suburb}` : ""}`,

  // Attention badges
  attentionBadgeRole: "status",
  attentionBadgeAriaLabel: (flag: AttentionFlag) =>
    `Attention needed: ${getAttentionFlagLabel(flag)}`,

  // Loading state
  loadingAriaLabel: "Loading campaigns",
  loadingRole: "status",

  // Empty state
  emptyAriaLabel: "No campaigns",
  emptyRole: "status",

  // Error state
  errorRole: "alert",
  errorAriaLive: "assertive" as const,
};
