import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { requireAdmin, whoami } from '../auth.js';
import { first, rows, run, type AppEnv, type Row } from '../pas.js';
import { fromJson, pickDefined } from '../lib.js';

const router = new Hono<AppEnv>();

export function hydrateUser(row: Row): Row {
  return {
    ...row,
    client_profile: fromJson(row.client_profile as string | null, null),
    walker_profile: fromJson(row.walker_profile as string | null, null),
    delivery_photos: fromJson(row.delivery_photos as string | null, null),
  };
}

// firestore.rules: never let users set role here or touch secrets; payment_mode is set-once (below).
const ALLOWED = [
  'email', 'name', 'photo_url', 'client_profile', 'walker_profile',
  'campaign_id', 'street', 'suburb', 'postcode', 'state', 'country',
  'location', 'phone_number', 'bio', 'website', 'linkedin',
  'door_count', 'delivery_photos', 'profile_completed',
] as const;

router.get('/users/:id', async (c) => {
  // User profiles are publicly readable (marked caller_unscoped in mcp.json)
  const row = await first(c, 'get_user', { id: c.req.param('id') });
  if (!row) throw new HTTPException(404, { message: 'user not found' });
  return c.json(hydrateUser(row));
});

router.patch('/users/:id', async (c) => {
  const me = await whoami(c);
  const targetId = c.req.param('id');
  const isSelf = me.id === targetId;
  const isAdmin = !isSelf && me.role === 'admin';
  if (!isSelf && !isAdmin) throw new HTTPException(403, { message: 'self or admin only' });

  const body = await c.req.json<Record<string, unknown>>();
  const updates = pickDefined(body, ALLOWED);

  // payment_mode is set-once unless admin
  if (body.payment_mode !== undefined) {
    if (isAdmin) {
      updates.payment_mode = body.payment_mode;
    } else if (!me.payment_mode) {
      if (body.payment_mode !== 'direct' && body.payment_mode !== 'platform') {
        throw new HTTPException(400, { message: "payment_mode must be 'direct' or 'platform'" });
      }
      updates.payment_mode = body.payment_mode;
    }
  }

  if (Object.keys(updates).length === 0) return c.json({ ok: true, changed: 0 });
  const patch = JSON.stringify(updates);
  const changed = isSelf
    ? await run(c, 'update_my_user', { patch })
    : await run(c, 'admin_update_user', { id: targetId, patch });
  return c.json({ ok: true, changed });
});

router.get('/users', async (c) => {
  await requireAdmin(c);
  const result = await rows(c, 'list_users', {
    role: c.req.query('role') || undefined,
    campaign_id: c.req.query('campaignId') || undefined,
    street: c.req.query('street') || undefined,
    suburb: c.req.query('suburb') || undefined,
    postcode: c.req.query('postcode') || undefined,
    location: c.req.query('location') || undefined,
  });
  return c.json(result.map(hydrateUser));
});

router.delete('/users/:id', async (c) => {
  await requireAdmin(c);
  const changed = await run(c, 'admin_delete_user', { id: c.req.param('id') });
  return c.json({ ok: true, changed });
});

router.post('/admin/users/:id/role', async (c) => {
  const me = await requireAdmin(c);
  const targetId = c.req.param('id');
  const { role } = await c.req.json<{ role?: string }>();
  if (role !== 'client' && role !== 'walker' && role !== 'admin') {
    throw new HTTPException(400, { message: "role must be 'client', 'walker', or 'admin'" });
  }
  if (me.id === targetId && role !== 'admin') {
    throw new HTTPException(409, { message: 'cannot remove your own admin role' });
  }
  const changed = await run(c, 'admin_set_user_role', { id: targetId, role });
  if (changed === 0) throw new HTTPException(404, { message: 'user not found' });
  return c.json({ ok: true, role });
});

router.post('/users/:id/walker-stats/increment', async (c) => {
  const me = await whoami(c);
  if (me.id !== c.req.param('id')) throw new HTTPException(403, { message: 'self only' });

  const body = await c.req.json<{
    campaignsCompleted?: number;
    doorsDelivered?: number;
    kmWalked?: number;
    minutesSpent?: number;
  }>();

  const row = await first<{ walker_profile: string | null }>(c, 'get_me');
  if (!row) throw new HTTPException(404, { message: 'user not found' });

  type WalkerStats = {
    totalCampaignsCompleted?: number;
    totalDoorsDelivered?: number;
    totalKmWalked?: number;
    totalMinutesSpent?: number;
  };
  const profile = fromJson<Record<string, unknown> & WalkerStats>(row.walker_profile, {});
  if (body.campaignsCompleted) profile.totalCampaignsCompleted = (profile.totalCampaignsCompleted ?? 0) + body.campaignsCompleted;
  if (body.doorsDelivered) profile.totalDoorsDelivered = (profile.totalDoorsDelivered ?? 0) + body.doorsDelivered;
  if (body.kmWalked) profile.totalKmWalked = (profile.totalKmWalked ?? 0) + body.kmWalked;
  if (body.minutesSpent) profile.totalMinutesSpent = (profile.totalMinutesSpent ?? 0) + body.minutesSpent;

  await run(c, 'update_my_user', { patch: JSON.stringify({ walker_profile: profile }) });
  return c.json({ ok: true, profile });
});

export default router;
