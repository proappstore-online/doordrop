import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { requireOwner } from '../auth.js';
import { call, first, rows, run, type AppEnv } from '../pas.js';
import { newId } from '../lib.js';

const router = new Hono<AppEnv>();

router.get('/interests', async (c) => {
  return c.json(await rows(c, 'list_interests', {
    walker_id: c.req.query('walkerId') || undefined,
    campaign_id: c.req.query('campaignId') || undefined,
  }));
});

router.post('/interests', async (c) => {
  const body = await c.req.json<{ campaignId?: string }>();
  if (typeof body.campaignId !== 'string' || body.campaignId.length === 0) {
    throw new HTTPException(400, { message: 'campaignId required' });
  }
  if (!(await first(c, 'get_campaign', { id: body.campaignId }))) {
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
