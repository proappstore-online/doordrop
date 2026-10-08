import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { requireAdmin, whoami } from '../auth.js';
import { rows, run, type AppEnv } from '../pas.js';
import { newId } from '../lib.js';

const router = new Hono<AppEnv>();

router.get('/history', async (c) => {
  const me = await whoami(c);
  const walkerId = c.req.query('walkerId');

  // Non-admins can only query their own history.
  if (walkerId && walkerId !== me.id && me.role !== 'admin') {
    throw new HTTPException(403, { message: 'can only query your own history' });
  }

  return c.json(await rows(c, 'list_history', { walker_id: walkerId || undefined }));
});

router.post('/history', async (c) => {
  const body = await c.req.json<Record<string, unknown>>();
  if (typeof body.date !== 'number') throw new HTTPException(400, { message: 'date required' });
  if (body.walkerId != null && body.walkerId !== (await whoami(c)).id) {
    throw new HTTPException(403, { message: 'self only' });
  }
  const id = newId();
  await run(c, 'create_history', {
    id,
    date: body.date,
    street_name: body.street_name,
    income: body.income,
    door_count: body.door_count,
    duration_min: body.duration_min,
  });
  return c.json({ id }, 201);
});

router.delete('/history/:id', async (c) => {
  await requireAdmin(c);
  await run(c, 'admin_delete_history', { id: c.req.param('id') });
  return c.json({ ok: true });
});

export default router;
