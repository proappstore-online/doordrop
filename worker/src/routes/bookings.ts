import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { requireCampaignAdmin } from '../auth.js';
import { rows, run, type AppEnv } from '../pas.js';
import { newId } from '../lib.js';

const router = new Hono<AppEnv>();

// Reads are scoped in the action: campaign admin or the booked walker.
router.get('/campaigns/:campaignId/bookings', async (c) => {
  return c.json(await rows(c, 'list_campaign_bookings', { campaign_id: c.req.param('campaignId') }));
});

router.post('/campaigns/:campaignId/bookings', async (c) => {
  const campaignId = c.req.param('campaignId');
  await requireCampaignAdmin(c, campaignId);
  const body = await c.req.json<{ walker_id?: string; date?: number; door_count?: number }>();
  if (typeof body.walker_id !== 'string' || body.walker_id.length === 0) {
    throw new HTTPException(400, { message: 'walker_id required' });
  }
  if (typeof body.date !== 'number' || !Number.isFinite(body.date)) {
    throw new HTTPException(400, { message: 'date required (epoch ms)' });
  }
  if (!Number.isInteger(body.door_count) || body.door_count! < 1 || body.door_count! > 100000) {
    throw new HTTPException(400, { message: 'door_count must be an integer 1-100000' });
  }
  const id = newId();
  const created = await run(c, 'create_booking', {
    id, campaign_id: campaignId, walker_id: body.walker_id, date: body.date, door_count: body.door_count, created_at: Date.now(),
  });
  if (created === 0) throw new HTTPException(400, { message: 'walker_id is not a walker' });
  return c.json({ id }, 201);
});

export default router;
