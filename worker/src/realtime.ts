import type { Ctx } from './pas.js';
import { publish } from './pas.js';

export type CampaignEvent =
  | { type: 'notes.changed'; campaignId: string; noteId: string; createdAt: number }
  | { type: 'doors.changed'; campaignId: string; doorId?: string }
  | { type: 'tracking.changed'; campaignId: string; sessionId: string }
  | { type: 'campaign.changed'; campaignId: string };

/** Publish a small invalidation only; D1 remains the source of truth. */
export function publishCampaignEvent(c: Ctx, event: CampaignEvent): Promise<void> {
  return publish(c, `campaign:${event.campaignId}`, event);
}
