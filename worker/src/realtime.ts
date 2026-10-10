import type { Ctx } from './pas.js';
import { publish } from './pas.js';

export type CampaignEvent =
  | { type: 'note.created'; campaignId: string; noteId: string; createdAt: number }
  | { type: 'door.changed'; campaignId: string; doorId?: string }
  | { type: 'tracking.changed'; campaignId: string; sessionId: string }
  | { type: 'campaign.changed'; campaignId: string };

/** Publish a small versioned domain event after a successful durable write.
 * Events are invalidations only; D1 remains the source of truth.
 * A failed publish never rolls back the business write.
 */
export function publishCampaignEvent(c: Ctx, event: CampaignEvent): Promise<void> {
  return publish(c, `campaign:${event.campaignId}`, event);
}
