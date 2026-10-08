import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { requireOwner, whoami } from '../auth.js';
import { rows, run, publishRoom, type AppEnv } from '../pas.js';

const router = new Hono<AppEnv>();

router.get('/notifications', async (c) => {
  const unread = c.req.query('unread') === 'true';
  return c.json(await rows(c, 'list_my_notifications', { unread: unread ? 1 : 0 }));
});

router.patch('/notifications/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ read?: boolean }>();
  if (typeof body.read !== 'boolean') {
    throw new HTTPException(400, { message: "only 'read' (boolean) is updatable" });
  }
  await requireOwner(c, 'notification_owner', id, 'notification not found', 'owner only');
  const userId = (await whoami(c)).id;
  await run(c, 'set_notification_read', { id, read: body.read ? 1 : 0 });
  void publishRoom(c, `user:${userId}:notifications`, { action: 'refresh' });
  return c.json({ ok: true });
});

router.post('/notifications/mark-all-read', async (c) => {
  const userId = (await whoami(c)).id;
  const changed = await run(c, 'mark_all_notifications_read');
  void publishRoom(c, `user:${userId}:notifications`, { action: 'refresh' });
  return c.json({ ok: true, changed });
});

export default router;
