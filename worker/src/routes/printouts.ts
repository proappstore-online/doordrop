import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { Env } from '../env.js';
import { requireAuth, requireCampaignAdmin } from '../auth.js';
import { newId, now } from '../lib.js';

const router = new Hono<{ Bindings: Env }>();

router.get('/campaigns/:campaignId/printouts', async (c) => {
  await requireAuth(c);
  const result = await c.env.DB.prepare(
    'SELECT * FROM printouts WHERE campaign_id = ? ORDER BY version DESC',
  )
    .bind(c.req.param('campaignId'))
    .all();
  return c.json(result.results);
});

router.post('/campaigns/:campaignId/printouts', async (c) => {
  const campaignId = c.req.param('campaignId');
  const auth = await requireCampaignAdmin(c, campaignId);
  const body = await c.req.json<Record<string, unknown>>();
  if (typeof body.name !== 'string' || body.name.length === 0 || body.name.length > 200) {
    throw new HTTPException(400, { message: 'name required (max 200)' });
  }
  const id = newId();
  const version = typeof body.version === 'number' ? body.version : 1;
  await c.env.DB.prepare(
    `INSERT INTO printouts (id, campaign_id, version, name, description, file_url, flyer_id, created_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, campaignId, version, body.name, body.description ?? null, body.file_url ?? null,
          body.flyer_id ?? null, now(), auth.id)
    .run();
  return c.json({ id }, 201);
});

router.patch('/campaigns/:campaignId/printouts/:printoutId', async (c) => {
  const campaignId = c.req.param('campaignId');
  await requireCampaignAdmin(c, campaignId);
  const body = await c.req.json<Record<string, unknown>>();
  const allowed = ['version', 'name', 'description', 'file_url', 'flyer_id'] as const;
  const updates: Record<string, unknown> = {};
  for (const k of allowed) if (body[k] !== undefined) updates[k] = body[k];
  if (Object.keys(updates).length === 0) return c.json({ ok: true, changed: 0 });
  const cols = Object.keys(updates);
  await c.env.DB.prepare(
    `UPDATE printouts SET ${cols.map((k) => `${k} = ?`).join(', ')} WHERE id = ? AND campaign_id = ?`,
  ).bind(...cols.map((k) => updates[k] ?? null), c.req.param('printoutId'), campaignId).run();
  return c.json({ ok: true });
});

router.delete('/campaigns/:campaignId/printouts/:printoutId', async (c) => {
  const campaignId = c.req.param('campaignId');
  await requireCampaignAdmin(c, campaignId);
  await c.env.DB.prepare('DELETE FROM printouts WHERE id = ? AND campaign_id = ?')
    .bind(c.req.param('printoutId'), campaignId)
    .run();
  return c.json({ ok: true });
});

export default router;
