import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { whoami } from '../auth.js';
import { rows, run, type AppEnv, type Ctx } from '../pas.js';
import { newId, pickDefined } from '../lib.js';

const router = new Hono<AppEnv>();

async function requireSelf(c: Ctx): Promise<void> {
  const me = await whoami(c);
  if (me.id !== c.req.param('userId')) throw new HTTPException(403, { message: 'self only' });
}

router.get('/users/:userId/flyers', async (c) => {
  await requireSelf(c);
  return c.json(await rows(c, 'list_my_flyers'));
});

router.post('/users/:userId/flyers', async (c) => {
  await requireSelf(c);
  const body = await c.req.json<Record<string, unknown>>();
  if (typeof body.name !== 'string' || body.name.length === 0 || body.name.length > 200) {
    throw new HTTPException(400, { message: 'name required (max 200)' });
  }
  const id = newId();
  await run(c, 'create_flyer', { id, name: body.name, description: body.description, file_url: body.file_url });
  return c.json({ id }, 201);
});

router.patch('/users/:userId/flyers/:flyerId', async (c) => {
  await requireSelf(c);
  const body = await c.req.json<Record<string, unknown>>();
  const updates = pickDefined(body, ['name', 'description', 'file_url']);
  if (Object.keys(updates).length === 0) return c.json({ ok: true, changed: 0 });
  if (typeof updates.name === 'string' && updates.name.length > 200) {
    throw new HTTPException(400, { message: 'name too long' });
  }
  await run(c, 'update_flyer', { id: c.req.param('flyerId'), patch: JSON.stringify(updates) });
  return c.json({ ok: true });
});

router.patch('/users/:userId/flyers/:flyerId/archive', async (c) => {
  await requireSelf(c);
  await run(c, 'archive_flyer', { id: c.req.param('flyerId') });
  return c.json({ ok: true });
});

router.patch('/users/:userId/flyers/:flyerId/unarchive', async (c) => {
  await requireSelf(c);
  await run(c, 'unarchive_flyer', { id: c.req.param('flyerId') });
  return c.json({ ok: true });
});

router.get('/users/:userId/flyers/:flyerId/campaigns', async (c) => {
  await requireSelf(c);
  const campaigns = await rows(c, 'list_campaigns_using_flyer', { flyer_id: c.req.param('flyerId') });
  return c.json(campaigns);
});

router.delete('/users/:userId/flyers/:flyerId', async (c) => {
  await requireSelf(c);
  const flyerId = c.req.param('flyerId');

  // Check for campaigns using this flyer
  const dependents = await rows(c, 'list_campaigns_using_flyer', { flyer_id: flyerId });
  if (dependents.length > 0) {
    return c.json(
      {
        error: 'Cannot delete flyer: it is referenced by campaigns',
        campaigns: dependents.map((d: any) => d.id)
      },
      409
    );
  }

  await run(c, 'delete_flyer', { id: flyerId });
  return c.json({ ok: true });
});

export default router;
