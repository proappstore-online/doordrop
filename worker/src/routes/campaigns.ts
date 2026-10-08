import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { requireCampaignAdmin, requireCampaignParticipant, whoami } from '../auth.js';
import { batch, first, rows, run, type AppEnv, type Params, type Row } from '../pas.js';
import { fromJson, newId, pickDefined, toJson } from '../lib.js';

const router = new Hono<AppEnv>();

const VALID_STATUSES = new Set(['draft', 'ready', 'assigned', 'complete', 'review', 'payment', 'archive']);

function hydrate(row: Row): Row {
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
  const me = await whoami(c);
  const status = c.req.query('status');
  let statuses: string | undefined;
  if (status) {
    const valid = status.split(',').filter((s) => VALID_STATUSES.has(s));
    if (valid.length === 0) throw new HTTPException(400, { message: 'invalid status filter' });
    statuses = JSON.stringify(valid);
  }

  // Only admins can filter other users' campaigns or browse all campaigns.
  // Regular users can only query their own campaigns via admin_id or walker_id.
  const adminId = c.req.query('adminId');
  const walkerId = c.req.query('walkerId');

  if (!me.role || me.role !== 'admin') {
    // Non-admin users can only see campaigns they're involved in.
    if ((adminId && adminId !== me.id) || (walkerId && walkerId !== me.id)) {
      throw new HTTPException(403, { message: 'can only query your own campaigns' });
    }
  }

  const result = await rows(c, 'list_campaigns', {
    statuses,
    admin_id: adminId || undefined,
    walker_id: walkerId || undefined,
    suburb: c.req.query('suburb') || undefined,
    postcode: c.req.query('postcode') || undefined,
  });
  return c.json(result.map(hydrate));
});

router.post('/campaigns', async (c) => {
  const me = await whoami(c);

  // Only clients and app admins can create campaigns
  if (me.role !== 'client' && me.role !== 'admin') {
    throw new HTTPException(403, { message: 'client role required' });
  }

  const body = await c.req.json<Record<string, unknown>>();

  if (typeof body.name !== 'string' || body.name.length === 0) {
    throw new HTTPException(400, { message: 'name required' });
  }
  const status = (body.status as string) || 'draft';
  if (!VALID_STATUSES.has(status)) throw new HTTPException(400, { message: 'invalid status' });

  // Creator is auto-added to admin_ids
  const adminIds = Array.isArray(body.admin_ids) ? (body.admin_ids as string[]) : [];
  if (!adminIds.includes(me.id)) adminIds.push(me.id);

  const id = newId();
  await run(c, 'create_campaign', {
    id,
    name: body.name,
    name_key: body.name_key,
    street_name: body.street_name,
    suburb: body.suburb,
    postcode: body.postcode,
    state: body.state,
    country: body.country,
    plan_type: body.plan_type,
    status,
    admin_ids: toJson(adminIds),
    member_ids: toJson(body.member_ids ?? []),
    assigned_walker_id: body.assigned_walker_id,
    schedule_rule: toJson(body.schedule_rule ?? null),
    user_payment: toJson(body.user_payment ?? null),
    total_doors: body.total_doors,
    budget: body.budget,
    due_date: body.due_date,
    lat: body.lat,
    lng: body.lng,
    door_radius_m: body.door_radius_m,
    junk_mail_policy: body.junk_mail_policy,
    property_filter: body.property_filter,
    business_categories: toJson(body.business_categories ?? []),
    active_printout_id: body.active_printout_id,
    job_status: body.job_status,
  });
  return c.json({ id, admin_ids: adminIds }, 201);
});

router.get('/campaigns/:id', async (c) => {
  const campaignId = c.req.param('id');
  await requireCampaignParticipant(c, campaignId);
  const row = await first(c, 'get_campaign', { id: campaignId });
  if (!row) throw new HTTPException(404, { message: 'campaign not found' });
  return c.json(hydrate(row));
});

const ALLOWED = [
  'name', 'name_key', 'street_name', 'suburb', 'postcode', 'state', 'country',
  'plan_type', 'status', 'admin_ids', 'member_ids', 'assigned_walker_id',
  'schedule_rule', 'user_payment', 'total_doors', 'budget', 'due_date',
  'completed_at', 'archived_at', 'lat', 'lng', 'door_radius_m',
  'junk_mail_policy', 'property_filter', 'business_categories',
  'active_printout_id', 'job_status',
] as const;

router.patch('/campaigns/:id', async (c) => {
  const campaignId = c.req.param('id');
  const current = await requireCampaignAdmin(c, campaignId);

  const body = await c.req.json<Record<string, unknown>>();
  const updates = pickDefined(body, ALLOWED);

  if (updates.status !== undefined && !VALID_STATUSES.has(updates.status as string)) {
    throw new HTTPException(400, { message: 'invalid status' });
  }
  if (updates.admin_ids !== undefined && !Array.isArray(updates.admin_ids)) {
    throw new HTTPException(400, { message: 'admin_ids must be array' });
  }

  // Validate assigned_walker_id is a walker (if provided)
  const newWalkerId = body.assigned_walker_id as string | undefined;
  if (newWalkerId) {
    const walker = await first(c, 'get_user', { id: newWalkerId });
    if (!walker) throw new HTTPException(400, { message: 'walker not found' });
    if ((walker as any).role !== 'walker') throw new HTTPException(400, { message: 'assigned_walker_id must be a walker' });
  }

  if (Object.keys(updates).length === 0) return c.json({ ok: true, changed: 0 });

  const calls: { name: string; params: Params }[] = [
    { name: 'update_campaign', params: { id: campaignId, patch: JSON.stringify(updates) } },
  ];
  // Notification trigger: assigned_walker_id changed to a non-null new value. Same transaction.
  if (newWalkerId && newWalkerId !== current.assigned_walker_id) {
    calls.push({ name: 'notify_walker_assigned', params: { campaign_id: campaignId, walker_id: newWalkerId } });
  }
  await batch(c, calls);
  return c.json({ ok: true });
});

router.delete('/campaigns/:id', async (c) => {
  const campaignId = c.req.param('id');
  await requireCampaignAdmin(c, campaignId);
  await run(c, 'delete_campaign', { id: campaignId });
  return c.json({ ok: true });
});

export default router;
