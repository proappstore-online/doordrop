import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { Env } from '../env.js';
import { requireAuth, requireAdmin } from '../auth.js';
import { newId } from '../lib.js';

const router = new Hono<{ Bindings: Env }>();

router.get('/history', async (c) => {
  await requireAuth(c);
  const walkerId = c.req.query('walkerId');
  const sql = walkerId
    ? 'SELECT * FROM history_records WHERE walker_id = ? ORDER BY date DESC LIMIT 500'
    : 'SELECT * FROM history_records ORDER BY date DESC LIMIT 500';
  const stmt = walkerId ? c.env.DB.prepare(sql).bind(walkerId) : c.env.DB.prepare(sql);
  const result = await stmt.all();
  return c.json(result.results);
});

router.post('/history', async (c) => {
  const auth = await requireAuth(c);
  const body = await c.req.json<Record<string, unknown>>();
  if (typeof body.date !== 'number') throw new HTTPException(400, { message: 'date required' });
  const walkerId = (body.walkerId as string) ?? auth.id;
  if (walkerId !== auth.id) throw new HTTPException(403, { message: 'self only' });
  const id = newId();
  await c.env.DB.prepare(
    `INSERT INTO history_records (id, walker_id, date, street_name, income, door_count, duration_min)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, walkerId, body.date, body.street_name ?? null,
          body.income ?? null, body.door_count ?? null, body.duration_min ?? null)
    .run();
  return c.json({ id }, 201);
});

router.delete('/history/:id', async (c) => {
  await requireAdmin(c);
  await c.env.DB.prepare('DELETE FROM history_records WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ ok: true });
});

export default router;
