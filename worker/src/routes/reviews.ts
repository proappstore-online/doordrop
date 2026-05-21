import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { Env } from '../env.js';
import { requireAuth } from '../auth.js';
import { newId, now } from '../lib.js';

const router = new Hono<{ Bindings: Env }>();

router.get('/walkers/:walkerId/reviews', async (c) => {
  await requireAuth(c);
  const result = await c.env.DB.prepare(
    'SELECT * FROM walker_reviews WHERE walker_id = ? ORDER BY created_at DESC LIMIT 500',
  )
    .bind(c.req.param('walkerId'))
    .all();
  return c.json(result.results);
});

router.post('/walkers/:walkerId/reviews', async (c) => {
  const auth = await requireAuth(c);
  const walkerId = c.req.param('walkerId');
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
  const ts = now();
  await c.env.DB.prepare(
    `INSERT INTO walker_reviews (id, walker_id, reviewer_id, reviewer_name, campaign_id, schedule_id,
                                 rating, comment, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, walkerId, auth.id, body.reviewerName ?? null,
          body.campaignId ?? null, body.scheduleId ?? null,
          body.rating, body.comment ?? null, ts, ts)
    .run();
  return c.json({ id }, 201);
});

router.patch('/reviews/:id', async (c) => {
  const auth = await requireAuth(c);
  const id = c.req.param('id');
  const row = await c.env.DB.prepare('SELECT reviewer_id FROM walker_reviews WHERE id = ?')
    .bind(id)
    .first<{ reviewer_id: string }>();
  if (!row) throw new HTTPException(404, { message: 'review not found' });
  if (row.reviewer_id !== auth.id) throw new HTTPException(403, { message: 'reviewer only' });

  const body = await c.req.json<{ rating?: number; comment?: string }>();
  const updates: Record<string, unknown> = {};
  if (body.rating !== undefined) {
    if (body.rating < 1 || body.rating > 5) throw new HTTPException(400, { message: 'rating 1-5' });
    updates.rating = body.rating;
  }
  if (body.comment !== undefined) {
    if (body.comment.length > 2000) throw new HTTPException(400, { message: 'comment too long' });
    updates.comment = body.comment;
  }
  if (Object.keys(updates).length === 0) return c.json({ ok: true, changed: 0 });
  updates.updated_at = now();
  const cols = Object.keys(updates);
  await c.env.DB.prepare(
    `UPDATE walker_reviews SET ${cols.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`,
  ).bind(...cols.map((k) => updates[k] ?? null), id).run();
  return c.json({ ok: true });
});

router.delete('/reviews/:id', async (c) => {
  const auth = await requireAuth(c);
  const id = c.req.param('id');
  const row = await c.env.DB.prepare('SELECT reviewer_id FROM walker_reviews WHERE id = ?')
    .bind(id)
    .first<{ reviewer_id: string }>();
  if (!row) throw new HTTPException(404, { message: 'review not found' });
  if (row.reviewer_id !== auth.id) throw new HTTPException(403, { message: 'reviewer only' });
  await c.env.DB.prepare('DELETE FROM walker_reviews WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
});

export default router;
