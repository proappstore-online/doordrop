import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { campaignAccess, requireCampaignAdmin, requireOwner, whoami } from '../auth.js';
import { call, first, rows, run, type AppEnv } from '../pas.js';
import { newId } from '../lib.js';

const router = new Hono<AppEnv>();

router.get('/interests', async (c) => {
  const me = await whoami(c);
  const campaignId = c.req.query('campaignId');
  const walkerId = c.req.query('walkerId');

  // If filtering by campaign, user must be campaign admin.
  if (campaignId) {
    await requireCampaignAdmin(c, campaignId);
  }

  // If filtering by walker, user must be admin or self.
  if (walkerId && walkerId !== me.id && me.role !== 'admin') {
    throw new HTTPException(403, { message: 'can only query your own interests' });
  }

  return c.json(await rows(c, 'list_interests', {
    walker_id: walkerId || undefined,
    campaign_id: campaignId || undefined,
  }));
});

router.post('/interests', async (c) => {
  const me = await whoami(c);

  // Only walkers can express interest
  if (me.role !== 'walker') {
    throw new HTTPException(403, { message: 'walker role required' });
  }

  const body = await c.req.json<{ campaignId?: string }>();
  if (typeof body.campaignId !== 'string' || body.campaignId.length === 0) {
    throw new HTTPException(400, { message: 'campaignId required' });
  }

  // Check if campaign exists (campaign_access returns null iff campaign does not exist)
  const campaign = await campaignAccess(c, body.campaignId);
  if (!campaign) {
    throw new HTTPException(404, { message: 'campaign not found' });
  }

  // One transaction: the interest, then a walker_interested notification to every campaign admin.
  const id = newId();
  const res = (await call(c, 'create_interest', { id, campaign_id: body.campaignId })) as {
    results?: { meta?: { changes?: number } }[];
  };
  // Nothing inserted: the UNIQUE (walker_id, campaign_id) constraint.
  if (!res.results?.[0]?.meta?.changes) throw new HTTPException(409, { message: 'already interested' });
  return c.json({ id }, 201);
});

router.delete('/interests/:id', async (c) => {
  const id = c.req.param('id');
  await requireOwner(c, 'interest_owner', id, 'interest not found', 'owner only');
  await run(c, 'delete_my_interest', { id });
  return c.json({ ok: true });
});

export default router;
