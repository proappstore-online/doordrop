import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { Env } from '../env.js';
import { requireAuth } from '../auth.js';
import { fromJson, newId, now, propertyId, toJson } from '../lib.js';

const router = new Hono<{ Bindings: Env }>();

function hydrate(row: Record<string, unknown>): Record<string, unknown> {
  return { ...row, access_user_ids: fromJson<string[]>(row.access_user_ids as string | null, []) };
}

router.get('/properties', async (c) => {
  const auth = await requireAuth(c);
  const userId = c.req.query('userId') ?? auth.id;
  if (userId !== auth.id) {
    // Admins could be allowed to scope by other users; keep simple for now.
    throw new HTTPException(403, { message: 'can only scope by self' });
  }
  const result = await c.env.DB.prepare(
    "SELECT * FROM properties WHERE EXISTS (SELECT 1 FROM json_each(access_user_ids) WHERE value = ?) ORDER BY created_at DESC LIMIT 500",
  )
    .bind(userId)
    .all();
  return c.json(result.results.map((r) => hydrate(r as Record<string, unknown>)));
});

router.post('/properties', async (c) => {
  const auth = await requireAuth(c);
  const body = await c.req.json<Record<string, unknown>>();
  if (typeof body.address !== 'string' || body.address.length === 0 || body.address.length > 500) {
    throw new HTTPException(400, { message: 'address required (max 500)' });
  }
  const suburb = (body.suburb as string) ?? '';
  const postcode = (body.postcode as string) ?? '';
  const id = propertyId(body.address, suburb, postcode);

  // Merge with existing (firestore semantics: arrayUnion accessUserIds, set merge=true)
  const existing = await c.env.DB.prepare('SELECT access_user_ids FROM properties WHERE id = ?')
    .bind(id)
    .first<{ access_user_ids: string }>();

  if (existing) {
    const ids = JSON.parse(existing.access_user_ids) as string[];
    if (!ids.includes(auth.id)) ids.push(auth.id);
    await c.env.DB.prepare('UPDATE properties SET access_user_ids = ? WHERE id = ?')
      .bind(toJson(ids), id)
      .run();
  } else {
    await c.env.DB.prepare(
      `INSERT INTO properties (id, address, street_name, house_number, suburb, postcode, state, lat, lng, commercial, access_user_ids, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id, body.address, body.street_name ?? null, body.house_number ?? null,
        suburb, postcode, body.state ?? null,
        body.lat ?? null, body.lng ?? null, body.commercial != null ? (body.commercial ? 1 : 0) : null,
        toJson([auth.id]), now(),
      )
      .run();
  }
  return c.json({ id }, 201);
});

router.get('/properties/:id', async (c) => {
  const auth = await requireAuth(c);
  const row = await c.env.DB.prepare('SELECT * FROM properties WHERE id = ?')
    .bind(c.req.param('id'))
    .first<Record<string, unknown>>();
  if (!row) throw new HTTPException(404, { message: 'property not found' });
  const ids = fromJson<string[]>(row.access_user_ids as string, []);
  if (!ids.includes(auth.id)) throw new HTTPException(403, { message: 'no access' });
  return c.json(hydrate(row));
});

router.patch('/properties/:id', async (c) => {
  const auth = await requireAuth(c);
  const propId = c.req.param('id');
  const existing = await c.env.DB.prepare('SELECT access_user_ids FROM properties WHERE id = ?')
    .bind(propId)
    .first<{ access_user_ids: string }>();
  if (!existing) throw new HTTPException(404, { message: 'property not found' });
  const existingIds = JSON.parse(existing.access_user_ids) as string[];
  if (!existingIds.includes(auth.id)) throw new HTTPException(403, { message: 'no access' });

  const body = await c.req.json<Record<string, unknown>>();
  const allowed = ['address', 'street_name', 'house_number', 'suburb', 'postcode', 'state',
                   'lat', 'lng', 'commercial', 'access_user_ids'] as const;
  const updates: Record<string, unknown> = {};
  for (const k of allowed) if (body[k] !== undefined) updates[k] = body[k];

  if (updates.access_user_ids !== undefined) {
    if (!Array.isArray(updates.access_user_ids)) {
      throw new HTTPException(400, { message: 'access_user_ids must be array' });
    }
    const newIds = updates.access_user_ids as string[];
    // Don't allow shrinking existing ids (firestore.rules: must hasAll(resource.data.accessUserIds))
    for (const oldId of existingIds) {
      if (!newIds.includes(oldId)) throw new HTTPException(403, { message: 'cannot remove existing access_user_ids' });
    }
    updates.access_user_ids = toJson(newIds);
  }
  if (typeof updates.commercial === 'boolean') updates.commercial = updates.commercial ? 1 : 0;

  if (Object.keys(updates).length === 0) return c.json({ ok: true, changed: 0 });
  const cols = Object.keys(updates);
  await c.env.DB.prepare(
    `UPDATE properties SET ${cols.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`,
  ).bind(...cols.map((k) => updates[k] ?? null), propId).run();
  return c.json({ ok: true });
});

router.post('/properties/:id/reports', async (c) => {
  const auth = await requireAuth(c);
  const propId = c.req.param('id');
  const existing = await c.env.DB.prepare('SELECT access_user_ids FROM properties WHERE id = ?')
    .bind(propId)
    .first<{ access_user_ids: string }>();
  if (!existing) throw new HTTPException(404, { message: 'property not found' });
  const ids = JSON.parse(existing.access_user_ids) as string[];
  if (!ids.includes(auth.id)) throw new HTTPException(403, { message: 'no access' });

  const body = await c.req.json<Record<string, unknown>>();
  const validReasons = ['no_house', 'construction', 'angry_owner', 'no_junk_mail', 'other'];
  if (typeof body.reason !== 'string' || !validReasons.includes(body.reason)) {
    throw new HTTPException(400, { message: 'invalid reason' });
  }
  const id = newId();
  await c.env.DB.prepare(
    `INSERT INTO property_reports (id, property_id, reason, photo_url, notes, reported_at, reported_by, campaign_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, propId, body.reason, body.photo_url ?? null, body.notes ?? null,
          now(), auth.id, body.campaign_id ?? null)
    .run();
  return c.json({ id }, 201);
});

router.get('/properties/:id/reports', async (c) => {
  const auth = await requireAuth(c);
  const propId = c.req.param('id');
  const existing = await c.env.DB.prepare('SELECT access_user_ids FROM properties WHERE id = ?')
    .bind(propId)
    .first<{ access_user_ids: string }>();
  if (!existing) throw new HTTPException(404, { message: 'property not found' });
  const ids = JSON.parse(existing.access_user_ids) as string[];
  if (!ids.includes(auth.id)) throw new HTTPException(403, { message: 'no access' });

  const result = await c.env.DB.prepare(
    'SELECT * FROM property_reports WHERE property_id = ? ORDER BY reported_at DESC',
  )
    .bind(propId)
    .all();
  return c.json(result.results);
});

export default router;
