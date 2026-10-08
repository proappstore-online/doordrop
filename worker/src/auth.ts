import { HTTPException } from 'hono/http-exception';
import { first, type Ctx } from './pas.js';

/**
 * Who the caller is. The platform authenticates every /.pas/worker request and
 * runs actions as that user, so there is no session handling here; these
 * helpers only resolve the caller's standing for the cross-row checks.
 */
export interface Me {
  id: string;
  role: string | null;
  payment_mode: string | null;
}

export async function whoami(c: Ctx): Promise<Me> {
  const me = await first<Me>(c, 'whoami');
  if (!me) throw new Error('whoami returned no row');
  return me;
}

export async function requireAdmin(c: Ctx): Promise<Me> {
  const me = await whoami(c);
  if (me.role !== 'admin') throw new HTTPException(403, { message: 'admin required' });
  return me;
}

export interface CampaignAccess {
  user_id: string;
  id: string;
  name: string;
  assigned_walker_id: string | null;
  is_admin: number;
  is_walker: number;
  is_platform_admin: number;
}

export function campaignAccess(c: Ctx, campaignId: string): Promise<CampaignAccess | null> {
  return first<CampaignAccess>(c, 'campaign_access', { id: campaignId });
}

export async function requireCampaignAdmin(c: Ctx, campaignId: string): Promise<CampaignAccess> {
  const access = await campaignAccess(c, campaignId);
  if (!access) throw new HTTPException(404, { message: 'campaign not found' });
  if (!access.is_admin) throw new HTTPException(403, { message: 'campaign-admin required' });
  return access;
}

export async function requireAssignedWalker(c: Ctx, campaignId: string): Promise<CampaignAccess> {
  const access = await campaignAccess(c, campaignId);
  if (!access) throw new HTTPException(404, { message: 'campaign not found' });
  if (!access.is_walker) throw new HTTPException(403, { message: 'assigned-walker required' });
  return access;
}

/** For rows owned by one user: 404 when the row is missing, 403 when it is someone else's. */
export async function requireOwner(c: Ctx, ownerAction: string, id: string, notFound: string, forbidden: string): Promise<void> {
  const row = await first<{ mine: number }>(c, ownerAction, { id });
  if (!row) throw new HTTPException(404, { message: notFound });
  if (!row.mine) throw new HTTPException(403, { message: forbidden });
}

/** Public campaign projection: safe fields for unauthenticated or non-participant reads */
export function publicCampaign(campaign: Record<string, unknown>): Record<string, unknown> {
  return {
    id: campaign.id,
    name: campaign.name,
    description: campaign.description,
    status: campaign.status,
    suburb: campaign.suburb,
    postcode: campaign.postcode,
    state: campaign.state,
    created_at: campaign.created_at,
    total_doors: campaign.total_doors,
    budget: campaign.budget,
    due_date: campaign.due_date,
  };
}

/** Check if user is a campaign participant: admin or assigned walker (or platform admin). */
export async function requireCampaignParticipant(c: Ctx, campaignId: string): Promise<CampaignAccess> {
  const access = await campaignAccess(c, campaignId);
  if (!access) throw new HTTPException(404, { message: 'campaign not found' });
  if (!access.is_admin && !access.is_walker && !access.is_platform_admin) {
    throw new HTTPException(403, { message: 'campaign-admin or assigned-walker required' });
  }
  return access;
}

export interface CampaignStatus {
  status: string;
}

export function campaignStatus(c: Ctx, campaignId: string): Promise<CampaignStatus | null> {
  return first<CampaignStatus>(c, 'get_campaign_status', { id: campaignId });
}

export async function requireActiveCampaign(c: Ctx, campaignId: string): Promise<void> {
  const campaign = await campaignStatus(c, campaignId);
  if (!campaign) throw new HTTPException(404, { message: 'campaign not found' });
  if (campaign.status !== 'ready' && campaign.status !== 'assigned') {
    throw new HTTPException(409, { message: 'campaign is not active' });
  }
}
