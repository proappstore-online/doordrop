import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { Env } from '../env.js';
import { requireAuth, requireAdmin } from '../auth.js';

const router = new Hono<{ Bindings: Env }>();

router.get('/config/platform', async (c) => {
  await requireAuth(c);
  const row = await c.env.DB.prepare('SELECT default_payment_mode FROM platform_config WHERE id = ?')
    .bind('platform')
    .first();
  return c.json(row ?? { default_payment_mode: 'platform' });
});

router.put('/config/platform', async (c) => {
  await requireAdmin(c);
  const body = await c.req.json<{ default_payment_mode?: string }>();
  if (body.default_payment_mode !== 'direct' && body.default_payment_mode !== 'platform') {
    throw new HTTPException(400, { message: "default_payment_mode must be 'direct' or 'platform'" });
  }
  await c.env.DB.prepare(
    `INSERT INTO platform_config (id, default_payment_mode) VALUES ('platform', ?)
     ON CONFLICT(id) DO UPDATE SET default_payment_mode = excluded.default_payment_mode`,
  )
    .bind(body.default_payment_mode)
    .run();
  return c.json({ ok: true });
});

export default router;
