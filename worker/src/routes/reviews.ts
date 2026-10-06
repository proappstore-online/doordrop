import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { requireOwner } from '../auth.js';
import { rows, run, type AppEnv } from '../pas.js';
import { newId } from '../lib.js';

const router = new Hono<AppEnv>();

router.get('/walkers/:walkerId/reviews', async (c) => {
  return c.json(await rows(c, 'list_walker_reviews', { walker_id: c.req.param('walkerId') }));
});

router.post('/walkers/:walkerId/reviews', async (c) => {
  const body = await c.req.json<{
    rating?: number; comment?: string; campaignId?: string; scheduleId?: string; reviewerName?: string;
  }>();
  if (typeof body.rating !== 'number' || body.rating < 1 || body.rating > 5) {
    throw new HTTPException(400, { message: 'rating must be 1-5' });
  }
  if (body.comment != null && body.comment.length > 2000) {
    throw new HTTPException(400, { message: 'comment too long (max 2000)' });
  }
  const id = newId();
  await run(c, 'create_review', {
    id,
    walker_id: c.req.param('walkerId'),
    reviewer_name: body.reviewerName,
    campaign_id: body.campaignId,
    schedule_id: body.scheduleId,
    rating: body.rating,
    comment: body.comment,
  });
  return c.json({ id }, 201);
});

router.patch('/reviews/:id', async (c) => {
  const id = c.req.param('id');
  await requireOwner(c, 'review_owner', id, 'review not found', 'reviewer only');

  const body = await c.req.json<{ rating?: number; comment?: string }>();
  if (body.rating !== undefined && (body.rating < 1 || body.rating > 5)) {
    throw new HTTPException(400, { message: 'rating 1-5' });
  }
  if (body.comment !== undefined && body.comment.length > 2000) {
    throw new HTTPException(400, { message: 'comment too long' });
  }
  if (body.rating === undefined && body.comment === undefined) return c.json({ ok: true, changed: 0 });
  await run(c, 'update_my_review', { id, rating: body.rating, comment: body.comment });
  return c.json({ ok: true });
});

router.delete('/reviews/:id', async (c) => {
  const id = c.req.param('id');
  await requireOwner(c, 'review_owner', id, 'review not found', 'reviewer only');
  await run(c, 'delete_my_review', { id });
  return c.json({ ok: true });
});

export default router;
