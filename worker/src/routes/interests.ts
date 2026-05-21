import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { Env } from '../env.js';
import { requireAuth } from '../auth.js';
import { newId, now } from '../lib.js';

const router = new Hono<{ Bindings: Env }>();

router.get('/interests', async (c) => {
  await requireAuth(c);
  const walkerId = c.req.query('walkerId');
  const campaignId = c.req.query('campaignId');
  const where: string[] = [];
  const params: unknown[] = [];
  if (walkerId) { where.push('walker_id = ?'); params.push(walkerId); }
  if (campaignId) { where.push('campaign_id = ?'); params.push(campaignId); }
  const sql = `SELECT * FROM walker_interests${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC LIMIT 500`;
  const stmt = params.length ? c.env.DB.prepare(sql).bind(...params) : c.env.DB.prepare(sql);
  const result = await stmt.all();
  return c.json(result.results);
});

router.post('/interests', async (c) => {
  const auth = await requireAuth(c);
  const body = await c.req.json<{ campaignId?: string }>();
  if (typeof body.campaignId !== 'string' || body.campaignId.length === 0) {
    throw new HTTPException(400, { message: 'campaignId required' });
  }
  const campaign = await c.env.DB.prepare('SELECT admin_ids, name FROM campaigns WHERE id = ?')
    .bind(body.campaignId)
    .first<{ admin_ids: string; name: string }>();
  if (!campaign) throw new HTTPException(404, { message: 'campaign not found' });

  const walker = await c.env.DB.prepare('SELECT name FROM users WHERE id = ?')
    .bind(auth.id)
    .first<{ name: string | null }>();
  const walkerName = walker?.name ?? auth.login;

  const id = newId();
  const ts = now();
  try {
    await c.env.DB.prepare(
      `INSERT INTO walker_interests (id, walker_id, campaign_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(id, auth.id, body.campaignId, ts, ts)
      .run();
  } catch (e) {
    // Probably the UNIQUE (walker_id, campaign_id) constraint.
    throw new HTTPException(409, { message: 'already interested' });
  }

  // Fire walker_interested notifications to all campaign admins (inline trigger).
  const adminIds = JSON.parse(campaign.admin_ids) as string[];
  const stmts = adminIds.map((adminId) =>
    c.env.DB.prepare(
      `INSERT INTO notifications (id, user_id, type, title, body, campaign_id, read, created_at)
       VALUES (?, ?, 'walker_interested', ?, ?, ?, 0, ?)`,
    ).bind(
      newId(),
      adminId,
      'New walker interested',
      `${walkerName} wants to deliver for ${campaign.name}`,
      body.campaignId,
      ts,
    ),
  );
  if (stmts.length > 0) await c.env.DB.batch(stmts);

  return c.json({ id }, 201);
});

router.delete('/interests/:id', async (c) => {
  const auth = await requireAuth(c);
  const id = c.req.param('id');
  const row = await c.env.DB.prepare('SELECT walker_id FROM walker_interests WHERE id = ?')
    .bind(id)
    .first<{ walker_id: string }>();
  if (!row) throw new HTTPException(404, { message: 'interest not found' });
  if (row.walker_id !== auth.id) throw new HTTPException(403, { message: 'owner only' });
  await c.env.DB.prepare('DELETE FROM walker_interests WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
});

export default router;
