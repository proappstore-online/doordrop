import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { campaignAccess, requireCampaignAdmin, requireCampaignParticipant } from '../auth.js';
import { first, rows, run, type AppEnv } from '../pas.js';
import { newId } from '../lib.js';

const router = new Hono<AppEnv>();

// Campaign admin, assigned walker or app admin (the action enforces the same).
router.get('/campaigns/:campaignId/delivery-runs', async (c) => {
  const campaignId = c.req.param('campaignId');
  const access = await campaignAccess(c, campaignId);
  if (!access) throw new HTTPException(404, { message: 'campaign not found' });
  if (!(access.is_admin || access.is_walker || access.is_platform_admin)) {
    throw new HTTPException(403, { message: 'campaign-admin or assigned-walker only' });
  }
  return c.json(await rows(c, 'list_delivery_runs', { campaign_id: campaignId }));
});

router.get('/delivery-runs/:id', async (c) => {
  const row = await first(c, 'get_delivery_run', { id: c.req.param('id') });
  if (!row) throw new HTTPException(404, { message: 'delivery run not found' });
  // Check authorization based on campaign_id from the delivery run
  const campaignId = row.campaign_id as string;
  if (campaignId) {
    const access = await campaignAccess(c, campaignId);
    if (!access || !(access.is_admin || access.is_walker || access.is_platform_admin)) {
      throw new HTTPException(403, { message: 'campaign-admin or assigned-walker only' });
    }
  }
  return c.json(row);
});

router.post('/campaigns/:campaignId/delivery-runs', async (c) => {
  const campaignId = c.req.param('campaignId');
  await requireCampaignAdmin(c, campaignId);
  const body = await c.req.json<{ date?: number; status?: string; walkerId?: string | null }>();
  if (typeof body.date !== 'number' || !Number.isFinite(body.date)) {
    throw new HTTPException(400, { message: 'date (epoch ms) required' });
  }
  if (body.status !== undefined && body.status !== 'scheduled' && body.status !== 'completed') {
    throw new HTTPException(400, { message: "status must be 'scheduled' or 'completed'" });
  }
  const id = newId();
  await run(c, 'create_delivery_run', {
    id,
    campaign_id: campaignId,
    walker_id: body.walkerId ?? undefined,
    status: body.status,
    date: body.date,
  });
  return c.json({ id }, 201);
});

export default router;
