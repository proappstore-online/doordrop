import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { Env } from '../env.js';
import { requireAuth } from '../auth.js';
import { newId, now } from '../lib.js';

const router = new Hono<{ Bindings: Env }>();

// Returns true if user is in campaign.admin_ids OR is the assigned walker.
async function canSeeNotes(env: Env, userId: string, campaignId: string): Promise<boolean> {
  const row = await env.DB.prepare(
    'SELECT admin_ids, assigned_walker_id FROM campaigns WHERE id = ?',
  )
    .bind(campaignId)
    .first<{ admin_ids: string; assigned_walker_id: string | null }>();
  if (!row) return false;
  const adminIds = JSON.parse(row.admin_ids) as string[];
  return adminIds.includes(userId) || row.assigned_walker_id === userId;
}

router.get('/campaigns/:campaignId/notes', async (c) => {
  const auth = await requireAuth(c);
  const campaignId = c.req.param('campaignId');
  if (!(await canSeeNotes(c.env, auth.id, campaignId))) {
    throw new HTTPException(403, { message: 'campaign-admin or assigned-walker only' });
  }
  const since = c.req.query('since');
  const sql = since
    ? 'SELECT * FROM campaign_notes WHERE campaign_id = ? AND created_at > ? ORDER BY created_at ASC LIMIT 500'
    : 'SELECT * FROM campaign_notes WHERE campaign_id = ? ORDER BY created_at ASC LIMIT 500';
  const stmt = since
    ? c.env.DB.prepare(sql).bind(campaignId, Number(since))
    : c.env.DB.prepare(sql).bind(campaignId);
  const result = await stmt.all();
  return c.json(result.results);
});

router.post('/campaigns/:campaignId/notes', async (c) => {
  const auth = await requireAuth(c);
  const campaignId = c.req.param('campaignId');
  if (!(await canSeeNotes(c.env, auth.id, campaignId))) {
    throw new HTTPException(403, { message: 'campaign-admin or assigned-walker only' });
  }
  const body = await c.req.json<{ text?: string; userName?: string }>();
  if (typeof body.text !== 'string' || body.text.length === 0 || body.text.length > 5000) {
    throw new HTTPException(400, { message: 'text required (max 5000)' });
  }
  if (typeof body.userName !== 'string' || body.userName.length === 0 || body.userName.length > 200) {
    throw new HTTPException(400, { message: 'userName required (max 200)' });
  }
  const id = newId();
  const ts = now();
  await c.env.DB.prepare(
    `INSERT INTO campaign_notes (id, campaign_id, user_id, user_name, text, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, campaignId, auth.id, body.userName, body.text, ts)
    .run();
  // fas.rooms broadcast wired in Task #10.
  return c.json({ id, createdAt: ts }, 201);
});

router.put('/users/:userId/chat-read-state/:campaignId', async (c) => {
  const auth = await requireAuth(c);
  const userId = c.req.param('userId');
  if (userId !== auth.id) throw new HTTPException(403, { message: 'self only' });
  const campaignId = c.req.param('campaignId');
  await c.env.DB.prepare(
    `INSERT INTO chat_read_state (user_id, campaign_id, last_read_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id, campaign_id) DO UPDATE SET last_read_at = excluded.last_read_at`,
  )
    .bind(userId, campaignId, now())
    .run();
  return c.json({ ok: true });
});

router.get('/users/:userId/chat-read-state', async (c) => {
  const auth = await requireAuth(c);
  const userId = c.req.param('userId');
  if (userId !== auth.id) throw new HTTPException(403, { message: 'self only' });
  const result = await c.env.DB.prepare(
    'SELECT campaign_id, last_read_at FROM chat_read_state WHERE user_id = ?',
  )
    .bind(userId)
    .all<{ campaign_id: string; last_read_at: number }>();
  const states: Record<string, { lastReadAt: number }> = {};
  for (const r of result.results) states[r.campaign_id] = { lastReadAt: r.last_read_at };
  return c.json(states);
});

export default router;
