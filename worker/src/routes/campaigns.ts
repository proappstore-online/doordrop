import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { Env } from '../env.js';
import { requireAuth, requireCampaignAdmin } from '../auth.js';
import { fromJson, newId, now, toJson } from '../lib.js';

const router = new Hono<{ Bindings: Env }>();

const VALID_STATUSES = new Set(['draft', 'ready', 'assigned', 'complete', 'review', 'payment', 'archive']);

const CAMPAIGN_COLUMNS = [
  'id', 'name', 'name_key', 'street_name', 'suburb', 'postcode', 'state', 'country',
  'plan_type', 'status', 'admin_ids', 'member_ids', 'assigned_walker_id', 'schedule_rule',
  'user_payment', 'total_doors', 'budget', 'due_date', 'completed_at', 'archived_at',
  'lat', 'lng', 'door_radius_m', 'junk_mail_policy', 'property_filter',
  'business_categories', 'active_printout_id', 'job_status',
  'created_at', 'updated_at',
].join(', ');

function hydrate(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    admin_ids: fromJson<string[]>(row.admin_ids as string | null, []),
    member_ids: fromJson<string[]>(row.member_ids as string | null, []),
    schedule_rule: fromJson(row.schedule_rule as string | null, null),
    user_payment: fromJson(row.user_payment as string | null, null),
    business_categories: fromJson<string[]>(row.business_categories as string | null, []),
  };
}

router.get('/campaigns', async (c) => {
  await requireAuth(c);
  const status = c.req.query('status');
  const adminId = c.req.query('adminId');
  const walkerId = c.req.query('walkerId');
  const suburb = c.req.query('suburb');
  const postcode = c.req.query('postcode');

  const where: string[] = [];
  const params: unknown[] = [];
  if (status) {
    const statuses = status.split(',').filter((s) => VALID_STATUSES.has(s));
    if (statuses.length === 0) throw new HTTPException(400, { message: 'invalid status filter' });
    where.push(`status IN (${statuses.map(() => '?').join(',')})`);
    params.push(...statuses);
  }
  if (adminId) {
    // JSON array contains
    where.push("EXISTS (SELECT 1 FROM json_each(admin_ids) WHERE value = ?)");
    params.push(adminId);
  }
  if (walkerId) { where.push('assigned_walker_id = ?'); params.push(walkerId); }
  if (suburb) { where.push('suburb = ?'); params.push(suburb); }
  if (postcode) { where.push('postcode = ?'); params.push(postcode); }

  const sql = `SELECT ${CAMPAIGN_COLUMNS} FROM campaigns${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC LIMIT 500`;
  const stmt = params.length ? c.env.DB.prepare(sql).bind(...params) : c.env.DB.prepare(sql);
  const result = await stmt.all();
  return c.json(result.results.map((r) => hydrate(r as Record<string, unknown>)));
});

router.post('/campaigns', async (c) => {
  const auth = await requireAuth(c);
  const body = await c.req.json<Record<string, unknown>>();

  if (typeof body.name !== 'string' || body.name.length === 0) {
    throw new HTTPException(400, { message: 'name required' });
  }
  const status = (body.status as string) || 'draft';
  if (!VALID_STATUSES.has(status)) throw new HTTPException(400, { message: 'invalid status' });

  // Creator is auto-added to admin_ids
  const adminIds = Array.isArray(body.admin_ids) ? (body.admin_ids as string[]) : [];
  if (!adminIds.includes(auth.id)) adminIds.push(auth.id);

  const id = newId();
  const ts = now();

  await c.env.DB.prepare(
    `INSERT INTO campaigns (
       id, name, name_key, street_name, suburb, postcode, state, country,
       plan_type, status, admin_ids, member_ids, assigned_walker_id, schedule_rule,
       user_payment, total_doors, budget, due_date, lat, lng, door_radius_m,
       junk_mail_policy, property_filter, business_categories, active_printout_id, job_status,
       created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id, body.name, body.name_key ?? null, body.street_name ?? null,
      body.suburb ?? null, body.postcode ?? null, body.state ?? null, body.country ?? null,
      body.plan_type ?? null, status, toJson(adminIds), toJson(body.member_ids ?? []),
      body.assigned_walker_id ?? null, toJson(body.schedule_rule ?? null),
      toJson(body.user_payment ?? null), body.total_doors ?? null, body.budget ?? null,
      body.due_date ?? null, body.lat ?? null, body.lng ?? null, body.door_radius_m ?? null,
      body.junk_mail_policy ?? null, body.property_filter ?? null,
      toJson(body.business_categories ?? []), body.active_printout_id ?? null,
      body.job_status ?? null, ts, ts,
    )
    .run();

  return c.json({ id, admin_ids: adminIds }, 201);
});

router.get('/campaigns/:id', async (c) => {
  await requireAuth(c);
  const row = await c.env.DB.prepare(`SELECT ${CAMPAIGN_COLUMNS} FROM campaigns WHERE id = ?`)
    .bind(c.req.param('id'))
    .first();
  if (!row) throw new HTTPException(404, { message: 'campaign not found' });
  return c.json(hydrate(row));
});

router.patch('/campaigns/:id', async (c) => {
  const campaignId = c.req.param('id');
  await requireCampaignAdmin(c, campaignId);

  const current = await c.env.DB.prepare('SELECT admin_ids, assigned_walker_id, name FROM campaigns WHERE id = ?')
    .bind(campaignId)
    .first<{ admin_ids: string; assigned_walker_id: string | null; name: string }>();
  if (!current) throw new HTTPException(404, { message: 'campaign not found' });

  const body = await c.req.json<Record<string, unknown>>();

  const allowed = [
    'name', 'name_key', 'street_name', 'suburb', 'postcode', 'state', 'country',
    'plan_type', 'status', 'admin_ids', 'member_ids', 'assigned_walker_id',
    'schedule_rule', 'user_payment', 'total_doors', 'budget', 'due_date',
    'completed_at', 'archived_at', 'lat', 'lng', 'door_radius_m',
    'junk_mail_policy', 'property_filter', 'business_categories',
    'active_printout_id', 'job_status',
  ] as const;

  const updates: Record<string, unknown> = {};
  for (const k of allowed) {
    if (body[k] !== undefined) updates[k] = body[k];
  }

  if (updates.status !== undefined && !VALID_STATUSES.has(updates.status as string)) {
    throw new HTTPException(400, { message: 'invalid status' });
  }

  // JSON columns
  if (updates.admin_ids !== undefined) {
    if (!Array.isArray(updates.admin_ids)) throw new HTTPException(400, { message: 'admin_ids must be array' });
    updates.admin_ids = toJson(updates.admin_ids);
  }
  if (updates.member_ids !== undefined) updates.member_ids = toJson(updates.member_ids);
  if (updates.schedule_rule !== undefined) updates.schedule_rule = toJson(updates.schedule_rule);
  if (updates.user_payment !== undefined) updates.user_payment = toJson(updates.user_payment);
  if (updates.business_categories !== undefined) updates.business_categories = toJson(updates.business_categories);

  if (Object.keys(updates).length === 0) return c.json({ ok: true, changed: 0 });
  updates.updated_at = now();

  const cols = Object.keys(updates);
  const setClause = cols.map((k) => `${k} = ?`).join(', ');
  const values = cols.map((k) => updates[k] ?? null);
  await c.env.DB.prepare(`UPDATE campaigns SET ${setClause} WHERE id = ?`).bind(...values, campaignId).run();

  // Notification trigger: assigned_walker_id changed to a non-null new value.
  const newWalkerId = body.assigned_walker_id as string | undefined;
  if (newWalkerId && newWalkerId !== current.assigned_walker_id) {
    await c.env.DB.prepare(
      `INSERT INTO notifications (id, user_id, type, title, body, campaign_id, read, created_at)
       VALUES (?, ?, 'walker_assigned', ?, ?, ?, 0, ?)`,
    )
      .bind(
        newId(),
        newWalkerId,
        "You've been assigned!",
        `You're delivering for ${current.name}`,
        campaignId,
        now(),
      )
      .run();
  }

  return c.json({ ok: true });
});

router.delete('/campaigns/:id', async (c) => {
  const campaignId = c.req.param('id');
  await requireCampaignAdmin(c, campaignId);
  await c.env.DB.prepare('DELETE FROM campaigns WHERE id = ?').bind(campaignId).run();
  return c.json({ ok: true });
});

export default router;
