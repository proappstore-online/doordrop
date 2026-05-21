import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { Env } from '../env.js';
import { requireAuth } from '../auth.js';

const router = new Hono<{ Bindings: Env }>();

router.get('/notifications', async (c) => {
  const auth = await requireAuth(c);
  const unread = c.req.query('unread') === 'true';
  const sql = unread
    ? 'SELECT * FROM notifications WHERE user_id = ? AND read = 0 ORDER BY created_at DESC LIMIT 200'
    : 'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 200';
  const result = await c.env.DB.prepare(sql).bind(auth.id).all();
  return c.json(result.results);
});

router.patch('/notifications/:id', async (c) => {
  const auth = await requireAuth(c);
  const id = c.req.param('id');
  const body = await c.req.json<{ read?: boolean }>();
  if (typeof body.read !== 'boolean') {
    throw new HTTPException(400, { message: "only 'read' (boolean) is updatable" });
  }
  const row = await c.env.DB.prepare('SELECT user_id FROM notifications WHERE id = ?')
    .bind(id)
    .first<{ user_id: string }>();
  if (!row) throw new HTTPException(404, { message: 'notification not found' });
  if (row.user_id !== auth.id) throw new HTTPException(403, { message: 'owner only' });
  await c.env.DB.prepare('UPDATE notifications SET read = ? WHERE id = ?')
    .bind(body.read ? 1 : 0, id)
    .run();
  return c.json({ ok: true });
});

router.post('/notifications/mark-all-read', async (c) => {
  const auth = await requireAuth(c);
  const result = await c.env.DB.prepare('UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0')
    .bind(auth.id)
    .run();
  return c.json({ ok: true, changed: result.meta.changes });
});

export default router;
