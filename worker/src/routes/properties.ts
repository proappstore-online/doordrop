import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { whoami } from '../auth.js';
import { first, rows, run, type AppEnv, type Ctx, type Row } from '../pas.js';
import { fromJson, newId, pickDefined, propertyId } from '../lib.js';

const router = new Hono<AppEnv>();

function hydrate(row: Row): Row {
  return { ...row, access_user_ids: fromJson<string[]>(row.access_user_ids as string | null, []) };
}

/** A property the caller has access to: 404 when it does not exist, 403 when they are not on it. */
async function requireProperty(c: Ctx, id: string): Promise<Row> {
  const row = await first(c, 'get_property', { id });
  if (row) return row;
  const access = await first(c, 'property_access', { id });
  if (!access) throw new HTTPException(404, { message: 'property not found' });
  throw new HTTPException(403, { message: 'no access' });
}

router.get('/properties', async (c) => {
  const userId = c.req.query('userId');
  if (userId !== undefined && userId !== (await whoami(c)).id) {
    // Admins could be allowed to scope by other users; keep simple for now.
    throw new HTTPException(403, { message: 'can only scope by self' });
  }
  const result = await rows(c, 'list_my_properties');
  return c.json(result.map(hydrate));
});

router.post('/properties', async (c) => {
  const body = await c.req.json<Record<string, unknown>>();
  if (typeof body.address !== 'string' || body.address.length === 0 || body.address.length > 500) {
    throw new HTTPException(400, { message: 'address required (max 500)' });
  }
  const suburb = (body.suburb as string) ?? '';
  const postcode = (body.postcode as string) ?? '';
  const id = propertyId(body.address, suburb, postcode);

  // Firestore semantics: create, or arrayUnion the caller into access_user_ids.
  await run(c, 'upsert_property', {
    id,
    address: body.address,
    street_name: body.street_name,
    house_number: body.house_number,
    suburb,
    postcode,
    state: body.state,
    lat: body.lat,
    lng: body.lng,
    commercial: body.commercial != null ? (body.commercial ? 1 : 0) : undefined,
  });
  return c.json({ id }, 201);
});

router.get('/properties/:id', async (c) => {
  return c.json(hydrate(await requireProperty(c, c.req.param('id'))));
});

const ALLOWED = ['address', 'street_name', 'house_number', 'suburb', 'postcode', 'state',
  'lat', 'lng', 'commercial', 'access_user_ids'] as const;

router.patch('/properties/:id', async (c) => {
  const propId = c.req.param('id');
  const existing = await requireProperty(c, propId);
  const existingIds = fromJson<string[]>(existing.access_user_ids as string, []);

  const body = await c.req.json<Record<string, unknown>>();
  const updates = pickDefined(body, ALLOWED);

  if (updates.access_user_ids !== undefined) {
    if (!Array.isArray(updates.access_user_ids)) {
      throw new HTTPException(400, { message: 'access_user_ids must be array' });
    }
    const newIds = updates.access_user_ids as string[];
    // Don't allow shrinking existing ids (firestore.rules: must hasAll(resource.data.accessUserIds))
    for (const oldId of existingIds) {
      if (!newIds.includes(oldId)) throw new HTTPException(403, { message: 'cannot remove existing access_user_ids' });
    }
  }

  if (Object.keys(updates).length === 0) return c.json({ ok: true, changed: 0 });
  await run(c, 'update_property', { id: propId, patch: JSON.stringify(updates) });
  return c.json({ ok: true });
});

const VALID_REASONS = ['no_house', 'construction', 'angry_owner', 'no_junk_mail', 'other'];

router.post('/properties/:id/reports', async (c) => {
  const propId = c.req.param('id');
  await requireProperty(c, propId);
  const body = await c.req.json<Record<string, unknown>>();
  if (typeof body.reason !== 'string' || !VALID_REASONS.includes(body.reason)) {
    throw new HTTPException(400, { message: 'invalid reason' });
  }
  const id = newId();
  await run(c, 'create_property_report', {
    id,
    property_id: propId,
    reason: body.reason,
    photo_url: body.photo_url,
    notes: body.notes,
    campaign_id: body.campaign_id,
  });
  return c.json({ id }, 201);
});

router.get('/properties/:id/reports', async (c) => {
  const propId = c.req.param('id');
  await requireProperty(c, propId);
  return c.json(await rows(c, 'list_property_reports', { property_id: propId }));
});

export default router;
