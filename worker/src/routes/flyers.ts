import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { Env } from '../env.js';
import { requireAuth } from '../auth.js';
import { newId, now } from '../lib.js';

const router = new Hono<{ Bindings: Env }>();

function requireSelf(authId: string, paramId: string): void {
  if (authId !== paramId) throw new HTTPException(403, { message: 'self only' });
}

router.get('/users/:userId/flyers', async (c) => {
  const auth = await requireAuth(c);
  requireSelf(auth.id, c.req.param('userId'));
  const result = await c.env.DB.prepare(
    'SELECT * FROM flyers WHERE owner_id = ? ORDER BY created_at DESC',
  )
    .bind(c.req.param('userId'))
    .all();
  return c.json(result.results);
});

router.post('/users/:userId/flyers', async (c) => {
  const auth = await requireAuth(c);
  const userId = c.req.param('userId');
  requireSelf(auth.id, userId);
  const body = await c.req.json<Record<string, unknown>>();
  if (typeof body.name !== 'string' || body.name.length === 0 || body.name.length > 200) {
    throw new HTTPException(400, { message: 'name required (max 200)' });
  }
  const id = newId();
  await c.env.DB.prepare(
    `INSERT INTO flyers (id, owner_id, name, description, file_url, created_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, userId, body.name, body.description ?? null, body.file_url ?? null, now(), auth.id)
    .run();
  return c.json({ id }, 201);
});

router.patch('/users/:userId/flyers/:flyerId', async (c) => {
  const auth = await requireAuth(c);
  requireSelf(auth.id, c.req.param('userId'));
  const body = await c.req.json<Record<string, unknown>>();
  const allowed = ['name', 'description', 'file_url'] as const;
  const updates: Record<string, unknown> = {};
  for (const k of allowed) if (body[k] !== undefined) updates[k] = body[k];
  if (Object.keys(updates).length === 0) return c.json({ ok: true, changed: 0 });
  if (typeof updates.name === 'string' && updates.name.length > 200) {
    throw new HTTPException(400, { message: 'name too long' });
  }
  const cols = Object.keys(updates);
  await c.env.DB.prepare(
    `UPDATE flyers SET ${cols.map((k) => `${k} = ?`).join(', ')} WHERE id = ? AND owner_id = ?`,
  ).bind(...cols.map((k) => updates[k] ?? null), c.req.param('flyerId'), c.req.param('userId')).run();
  return c.json({ ok: true });
});

router.delete('/users/:userId/flyers/:flyerId', async (c) => {
  const auth = await requireAuth(c);
  requireSelf(auth.id, c.req.param('userId'));
  await c.env.DB.prepare('DELETE FROM flyers WHERE id = ? AND owner_id = ?')
    .bind(c.req.param('flyerId'), c.req.param('userId'))
    .run();
  return c.json({ ok: true });
});

export default router;
