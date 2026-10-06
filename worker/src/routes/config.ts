import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { requireAdmin } from '../auth.js';
import { first, run, type AppEnv } from '../pas.js';

const router = new Hono<AppEnv>();

router.get('/config/platform', async (c) => {
  return c.json((await first(c, 'get_platform_config')) ?? { default_payment_mode: 'platform' });
});

router.put('/config/platform', async (c) => {
  await requireAdmin(c);
  const body = await c.req.json<{ default_payment_mode?: string }>();
  if (body.default_payment_mode !== 'direct' && body.default_payment_mode !== 'platform') {
    throw new HTTPException(400, { message: "default_payment_mode must be 'direct' or 'platform'" });
  }
  await run(c, 'set_platform_config', { default_payment_mode: body.default_payment_mode });
  return c.json({ ok: true });
});

export default router;
