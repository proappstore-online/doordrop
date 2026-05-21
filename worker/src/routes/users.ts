import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { Env } from '../env.js';
import { requireAuth, requireAdmin } from '../auth.js';
import { fromJson, now, toJson } from '../lib.js';

const router = new Hono<{ Bindings: Env }>();

const USER_COLUMNS = [
  'id', 'email', 'name', 'photo_url', 'role', 'payment_mode',
  'client_profile', 'walker_profile', 'campaign_id',
  'street', 'suburb', 'postcode', 'state', 'country', 'location',
  'phone_number', 'bio', 'website', 'linkedin', 'door_count',
  'delivery_photos', 'profile_completed',
  'created_at', 'updated_at', 'last_logged_in_at',
].join(', ');

function hydrateUser(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    client_profile: fromJson(row.client_profile as string | null, null),
    walker_profile: fromJson(row.walker_profile as string | null, null),
    delivery_photos: fromJson(row.delivery_photos as string | null, null),
  };
}

router.get('/users/:id', async (c) => {
  await requireAuth(c);
  const row = await c.env.DB.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`)
    .bind(c.req.param('id'))
    .first();
  if (!row) throw new HTTPException(404, { message: 'user not found' });
  return c.json(hydrateUser(row));
});

router.patch('/users/:id', async (c) => {
  const auth = await requireAuth(c);
  const targetId = c.req.param('id');

  const isSelf = auth.id === targetId;
  let isAdmin = false;
  if (!isSelf) {
    const r = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?')
      .bind(auth.id)
      .first<{ role: string | null }>();
    isAdmin = r?.role === 'admin';
    if (!isAdmin) throw new HTTPException(403, { message: 'self or admin only' });
  }

  const body = await c.req.json<Record<string, unknown>>();

  // Field allow-list (firestore.rules: never let users set role here or touch secrets;
  // payment_mode set-once-only handled below).
  const allowed = [
    'email', 'name', 'photo_url', 'client_profile', 'walker_profile',
    'campaign_id', 'street', 'suburb', 'postcode', 'state', 'country',
    'location', 'phone_number', 'bio', 'website', 'linkedin',
    'door_count', 'delivery_photos', 'profile_completed',
  ] as const;

  const updates: Record<string, unknown> = {};
  for (const k of allowed) {
    if (body[k] !== undefined) updates[k] = body[k];
  }

  // JSON columns
  if ('client_profile' in updates) updates.client_profile = toJson(updates.client_profile);
  if ('walker_profile' in updates) updates.walker_profile = toJson(updates.walker_profile);
  if ('delivery_photos' in updates) updates.delivery_photos = toJson(updates.delivery_photos);

  // payment_mode is set-once unless admin
  if (body.payment_mode !== undefined) {
    if (isAdmin) {
      updates.payment_mode = body.payment_mode;
    } else {
      const existing = await c.env.DB.prepare('SELECT payment_mode FROM users WHERE id = ?')
        .bind(targetId)
        .first<{ payment_mode: string | null }>();
      if (!existing?.payment_mode) {
        if (body.payment_mode !== 'direct' && body.payment_mode !== 'platform') {
          throw new HTTPException(400, { message: "payment_mode must be 'direct' or 'platform'" });
        }
        updates.payment_mode = body.payment_mode;
      }
    }
  }

  if (Object.keys(updates).length === 0) {
    return c.json({ ok: true, changed: 0 });
  }

  updates.updated_at = now();
  const cols = Object.keys(updates);
  const setClause = cols.map((k) => `${k} = ?`).join(', ');
  const values = cols.map((k) => updates[k] ?? null);

  const result = await c.env.DB.prepare(`UPDATE users SET ${setClause} WHERE id = ?`)
    .bind(...values, targetId)
    .run();
  return c.json({ ok: true, changed: result.meta.changes });
});

router.get('/users', async (c) => {
  await requireAuth(c);
  const role = c.req.query('role');
  const campaignId = c.req.query('campaignId');
  const street = c.req.query('street');
  const suburb = c.req.query('suburb');
  const postcode = c.req.query('postcode');
  const location = c.req.query('location');

  const where: string[] = [];
  const params: unknown[] = [];
  if (role) { where.push('role = ?'); params.push(role); }
  if (campaignId) { where.push('campaign_id = ?'); params.push(campaignId); }
  if (street) { where.push('street = ?'); params.push(street); }
  if (suburb) { where.push('suburb = ?'); params.push(suburb); }
  if (postcode) { where.push('postcode = ?'); params.push(postcode); }
  if (location) { where.push('location = ?'); params.push(location); }

  const sql = `SELECT ${USER_COLUMNS} FROM users${where.length ? ' WHERE ' + where.join(' AND ') : ''} LIMIT 500`;
  const stmt = params.length ? c.env.DB.prepare(sql).bind(...params) : c.env.DB.prepare(sql);
  const result = await stmt.all();
  return c.json(result.results.map((r) => hydrateUser(r as Record<string, unknown>)));
});

router.delete('/users/:id', async (c) => {
  await requireAdmin(c);
  const result = await c.env.DB.prepare('DELETE FROM users WHERE id = ?')
    .bind(c.req.param('id'))
    .run();
  return c.json({ ok: true, changed: result.meta.changes });
});

router.post('/admin/users/:id/role', async (c) => {
  const auth = await requireAdmin(c);
  const targetId = c.req.param('id');
  const { role } = await c.req.json<{ role?: string }>();
  if (role !== 'client' && role !== 'walker' && role !== 'admin') {
    throw new HTTPException(400, { message: "role must be 'client', 'walker', or 'admin'" });
  }
  if (auth.id === targetId && role !== 'admin') {
    throw new HTTPException(409, { message: 'cannot remove your own admin role' });
  }
  const result = await c.env.DB.prepare('UPDATE users SET role = ?, updated_at = ? WHERE id = ?')
    .bind(role, now(), targetId)
    .run();
  if (result.meta.changes === 0) throw new HTTPException(404, { message: 'user not found' });
  return c.json({ ok: true, role });
});

router.post('/users/:id/walker-stats/increment', async (c) => {
  const auth = await requireAuth(c);
  const targetId = c.req.param('id');
  if (auth.id !== targetId) throw new HTTPException(403, { message: 'self only' });

  const body = await c.req.json<{
    campaignsCompleted?: number;
    doorsDelivered?: number;
    kmWalked?: number;
    minutesSpent?: number;
  }>();

  const row = await c.env.DB.prepare('SELECT walker_profile FROM users WHERE id = ?')
    .bind(targetId)
    .first<{ walker_profile: string | null }>();
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

  await c.env.DB.prepare('UPDATE users SET walker_profile = ?, updated_at = ? WHERE id = ?')
    .bind(toJson(profile), now(), targetId)
    .run();
  return c.json({ ok: true, profile });
});

export default router;
