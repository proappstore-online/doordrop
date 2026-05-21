import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { Env } from '../env.js';
import { requireAuth, requireAssignedWalker, requireCampaignAdmin } from '../auth.js';
import { fromJson, newId, now, toJson } from '../lib.js';

const router = new Hono<{ Bindings: Env }>();

const VALID_STATUSES = new Set(['pending', 'delivered', 'reported']);

function hydrate(row: Record<string, unknown>): Record<string, unknown> {
  return { ...row, history: fromJson(row.history as string | null, []) };
}

router.get('/campaigns/:campaignId/doors', async (c) => {
  await requireAuth(c);
  const result = await c.env.DB.prepare(
    'SELECT * FROM doors WHERE campaign_id = ? ORDER BY street_name, house_number',
  )
    .bind(c.req.param('campaignId'))
    .all();
  return c.json(result.results.map((r) => hydrate(r as Record<string, unknown>)));
});

router.post('/campaigns/:campaignId/doors', async (c) => {
  const campaignId = c.req.param('campaignId');
  await requireCampaignAdmin(c, campaignId);
  const body = await c.req.json<Record<string, unknown>>();
  if (typeof body.address !== 'string' || body.address.length === 0) {
    throw new HTTPException(400, { message: 'address required' });
  }
  const id = newId();
  await c.env.DB.prepare(
    `INSERT INTO doors (id, campaign_id, address, street_name, house_number, lat, lng, status,
                         delivered_at, delivered_by, delivery_count, history, property_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 0, ?, ?)`,
  )
    .bind(
      id, campaignId, body.address, body.street_name ?? null, body.house_number ?? null,
      body.lat ?? null, body.lng ?? null, (body.status as string) ?? 'pending',
      toJson([]), body.property_id ?? null,
    )
    .run();
  return c.json({ id }, 201);
});

router.post('/campaigns/:campaignId/doors/bulk', async (c) => {
  const campaignId = c.req.param('campaignId');
  await requireCampaignAdmin(c, campaignId);
  const body = await c.req.json<{ doors: Array<Record<string, unknown>> }>();
  if (!Array.isArray(body.doors) || body.doors.length === 0) {
    throw new HTTPException(400, { message: 'doors must be a non-empty array' });
  }
  const stmts = body.doors.map((d) =>
    c.env.DB.prepare(
      `INSERT INTO doors (id, campaign_id, address, street_name, house_number, lat, lng, status,
                           delivered_at, delivered_by, delivery_count, history, property_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 0, ?, ?)`,
    ).bind(
      newId(), campaignId, d.address, d.street_name ?? null, d.house_number ?? null,
      d.lat ?? null, d.lng ?? null, (d.status as string) ?? 'pending',
      toJson([]), d.property_id ?? null,
    ),
  );
  await c.env.DB.batch(stmts);
  return c.json({ ok: true, count: body.doors.length }, 201);
});

router.patch('/campaigns/:campaignId/doors/:doorId', async (c) => {
  const auth = await requireAuth(c);
  const campaignId = c.req.param('campaignId');
  const doorId = c.req.param('doorId');

  // Authz: campaign-admin can update any field; assigned-walker only the delivery allow-list.
  const campaign = await c.env.DB.prepare('SELECT admin_ids, assigned_walker_id FROM campaigns WHERE id = ?')
    .bind(campaignId)
    .first<{ admin_ids: string; assigned_walker_id: string | null }>();
  if (!campaign) throw new HTTPException(404, { message: 'campaign not found' });
  const adminIds = JSON.parse(campaign.admin_ids) as string[];
  const isCampaignAdmin = adminIds.includes(auth.id);
  const isAssignedWalker = campaign.assigned_walker_id === auth.id;
  if (!isCampaignAdmin && !isAssignedWalker) {
    throw new HTTPException(403, { message: 'campaign-admin or assigned-walker required' });
  }

  const body = await c.req.json<Record<string, unknown>>();

  const adminAllowed = ['address', 'street_name', 'house_number', 'lat', 'lng', 'status',
                       'delivered_at', 'delivered_by', 'delivery_count', 'history', 'property_id'] as const;
  const walkerAllowed = ['status', 'delivered_at', 'delivered_by', 'delivery_count', 'history'] as const;
  const allowed: readonly string[] = isCampaignAdmin ? adminAllowed : walkerAllowed;

  const updates: Record<string, unknown> = {};
  for (const k of allowed) {
    if (body[k] !== undefined) updates[k] = body[k];
  }

  if (updates.status !== undefined && !VALID_STATUSES.has(updates.status as string)) {
    throw new HTTPException(400, { message: 'invalid status' });
  }
  if (!isCampaignAdmin && 'delivered_by' in updates && updates.delivered_by !== auth.id) {
    throw new HTTPException(403, { message: 'delivered_by must match self' });
  }
  if (updates.history !== undefined) updates.history = toJson(updates.history);

  if (Object.keys(updates).length === 0) return c.json({ ok: true, changed: 0 });

  const cols = Object.keys(updates);
  const setClause = cols.map((k) => `${k} = ?`).join(', ');
  const values = cols.map((k) => updates[k] ?? null);
  await c.env.DB.prepare(`UPDATE doors SET ${setClause} WHERE id = ? AND campaign_id = ?`)
    .bind(...values, doorId, campaignId)
    .run();
  return c.json({ ok: true });
});

router.delete('/campaigns/:campaignId/doors/:doorId', async (c) => {
  const campaignId = c.req.param('campaignId');
  await requireCampaignAdmin(c, campaignId);
  await c.env.DB.prepare('DELETE FROM doors WHERE id = ? AND campaign_id = ?')
    .bind(c.req.param('doorId'), campaignId)
    .run();
  return c.json({ ok: true });
});

export default router;
