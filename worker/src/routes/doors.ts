import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { campaignAccess, requireCampaignAdmin, requireCampaignParticipant, requireActiveCampaign } from '../auth.js';
import { batch, rows, run, type AppEnv, type Row } from '../pas.js';
import { fromJson, newId, pickDefined } from '../lib.js';
import { publishCampaignEvent } from '../realtime.js';

const router = new Hono<AppEnv>();

const VALID_STATUSES = new Set(['pending', 'delivered', 'reported']);

function hydrate(row: Row): Row {
  return { ...row, history: fromJson(row.history as string | null, []) };
}

function doorParams(campaignId: string, d: Record<string, unknown>) {
  return {
    id: newId(),
    campaign_id: campaignId,
    address: d.address,
    street_name: d.street_name,
    house_number: d.house_number,
    lat: d.lat,
    lng: d.lng,
    status: d.status,
    property_id: d.property_id,
  };
}

router.get('/campaigns/:campaignId/doors', async (c) => {
  const campaignId = c.req.param('campaignId');
  await requireCampaignParticipant(c, campaignId);
  const result = await rows(c, 'list_doors', { campaign_id: campaignId });
  return c.json(result.map(hydrate));
});

router.post('/campaigns/:campaignId/doors', async (c) => {
  const campaignId = c.req.param('campaignId');
  await requireCampaignAdmin(c, campaignId);
  const body = await c.req.json<Record<string, unknown>>();
  if (typeof body.address !== 'string' || body.address.length === 0) {
    throw new HTTPException(400, { message: 'address required' });
  }
  const params = doorParams(campaignId, body);
  await run(c, 'create_door', params);
  await publishCampaignEvent(c, { type: 'door.changed', campaignId, doorId: params.id });
  return c.json({ id: params.id }, 201);
});

router.post('/campaigns/:campaignId/doors/bulk', async (c) => {
  const campaignId = c.req.param('campaignId');
  await requireCampaignAdmin(c, campaignId);
  const body = await c.req.json<{ doors: Array<Record<string, unknown>> }>();
  if (!Array.isArray(body.doors) || body.doors.length === 0) {
    throw new HTTPException(400, { message: 'doors must be a non-empty array' });
  }
  await batch(c, body.doors.map((d) => ({ name: 'create_door', params: doorParams(campaignId, d) })));
  await publishCampaignEvent(c, { type: 'door.changed', campaignId });
  return c.json({ ok: true, count: body.doors.length }, 201);
});

const ADMIN_ALLOWED = ['address', 'street_name', 'house_number', 'lat', 'lng', 'status',
  'delivered_at', 'delivered_by', 'delivery_count', 'history', 'property_id'] as const;
const WALKER_ALLOWED = ['status', 'delivered_at', 'delivered_by', 'delivery_count', 'history'] as const;

router.patch('/campaigns/:campaignId/doors/:doorId', async (c) => {
  const campaignId = c.req.param('campaignId');
  const doorId = c.req.param('doorId');

  // Delivery writes only allowed in active campaigns (ready or assigned)
  await requireActiveCampaign(c, campaignId);

  // Authz: campaign-admin can update any field; assigned-walker only the delivery allow-list.
  const access = await campaignAccess(c, campaignId);
  if (!access) throw new HTTPException(404, { message: 'campaign not found' });
  const isCampaignAdmin = !!access.is_admin;
  if (!isCampaignAdmin && !access.is_walker) {
    throw new HTTPException(403, { message: 'campaign-admin or assigned-walker required' });
  }

  const body = await c.req.json<Record<string, unknown>>();
  const updates = pickDefined(body, isCampaignAdmin ? ADMIN_ALLOWED : WALKER_ALLOWED);

  if (updates.status !== undefined && !VALID_STATUSES.has(updates.status as string)) {
    throw new HTTPException(400, { message: 'invalid status' });
  }
  if (!isCampaignAdmin && 'delivered_by' in updates && updates.delivered_by !== access.user_id) {
    throw new HTTPException(403, { message: 'delivered_by must match self' });
  }
  if (Object.keys(updates).length === 0) return c.json({ ok: true, changed: 0 });

  await run(c, isCampaignAdmin ? 'update_door_as_admin' : 'update_door_as_walker', {
    id: doorId,
    campaign_id: campaignId,
    patch: JSON.stringify(updates),
  });
  await publishCampaignEvent(c, { type: 'door.changed', campaignId, doorId });
  return c.json({ ok: true });
});

router.delete('/campaigns/:campaignId/doors/:doorId', async (c) => {
  const campaignId = c.req.param('campaignId');
  const doorId = c.req.param('doorId');
  await requireCampaignAdmin(c, campaignId);
  await run(c, 'delete_door', { id: doorId, campaign_id: campaignId });
  await publishCampaignEvent(c, { type: 'door.changed', campaignId, doorId });
  return c.json({ ok: true });
});

export default router;
