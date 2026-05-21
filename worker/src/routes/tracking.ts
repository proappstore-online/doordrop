import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { Env } from '../env.js';
import { requireAuth, requireAssignedWalker } from '../auth.js';
import { newId, now } from '../lib.js';

const router = new Hono<{ Bindings: Env }>();

// POST /campaigns/:campaignId/track-sessions — start a new tracking session (assigned-walker)
router.post('/campaigns/:campaignId/track-sessions', async (c) => {
  const campaignId = c.req.param('campaignId');
  const auth = await requireAssignedWalker(c, campaignId);
  const id = newId();
  await c.env.DB.prepare(
    `INSERT INTO track_sessions (id, campaign_id, walker_id, started_at, ended_at)
     VALUES (?, ?, ?, ?, NULL)`,
  )
    .bind(id, campaignId, auth.id, now())
    .run();
  return c.json({ id, started_at: now() }, 201);
});

// GET /campaigns/:campaignId/track-sessions — campaign-admin, assigned-walker, or platform admin
router.get('/campaigns/:campaignId/track-sessions', async (c) => {
  const auth = await requireAuth(c);
  const campaignId = c.req.param('campaignId');
  const row = await c.env.DB.prepare('SELECT admin_ids, assigned_walker_id FROM campaigns WHERE id = ?')
    .bind(campaignId)
    .first<{ admin_ids: string; assigned_walker_id: string | null }>();
  if (!row) throw new HTTPException(404, { message: 'campaign not found' });
  const adminIds = JSON.parse(row.admin_ids) as string[];
  const userRow = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(auth.id).first<{ role: string | null }>();
  const isPlatformAdmin = userRow?.role === 'admin';
  if (!adminIds.includes(auth.id) && row.assigned_walker_id !== auth.id && !isPlatformAdmin) {
    throw new HTTPException(403, { message: 'no access' });
  }
  const sessions = await c.env.DB.prepare(
    'SELECT * FROM track_sessions WHERE campaign_id = ? ORDER BY started_at DESC LIMIT 200',
  )
    .bind(campaignId)
    .all();
  return c.json(sessions.results);
});

async function ownsSession(env: Env, sessionId: string, userId: string): Promise<boolean> {
  const row = await env.DB.prepare('SELECT walker_id FROM track_sessions WHERE id = ?')
    .bind(sessionId)
    .first<{ walker_id: string }>();
  return row?.walker_id === userId;
}

// POST /track-sessions/:id/append — batch insert points + stops (session owner only).
// Body: { points: [{t, lat, lng, speed?}, ...], stops: [{lat, lng, startTime, endTime}, ...] }
router.post('/track-sessions/:id/append', async (c) => {
  const auth = await requireAuth(c);
  const sessionId = c.req.param('id');
  if (!(await ownsSession(c.env, sessionId, auth.id))) {
    throw new HTTPException(403, { message: 'session owner only' });
  }
  const body = await c.req.json<{
    points?: Array<{ t: number; lat: number; lng: number; speed?: number }>;
    stops?: Array<{ lat: number; lng: number; startTime: number; endTime: number }>;
  }>();
  const points = Array.isArray(body.points) ? body.points : [];
  const stops = Array.isArray(body.stops) ? body.stops : [];
  if (points.length === 0 && stops.length === 0) return c.json({ ok: true, points: 0, stops: 0 });

  const stmts: D1PreparedStatement[] = [];
  for (const p of points) {
    if (typeof p.t !== 'number' || typeof p.lat !== 'number' || typeof p.lng !== 'number') continue;
    stmts.push(
      c.env.DB.prepare(
        'INSERT OR IGNORE INTO track_points (session_id, t, lat, lng, speed) VALUES (?, ?, ?, ?, ?)',
      ).bind(sessionId, p.t, p.lat, p.lng, p.speed ?? null),
    );
  }
  for (const s of stops) {
    if (typeof s.lat !== 'number' || typeof s.lng !== 'number'
        || typeof s.startTime !== 'number' || typeof s.endTime !== 'number') continue;
    stmts.push(
      c.env.DB.prepare(
        'INSERT INTO track_stops (id, session_id, lat, lng, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?)',
      ).bind(newId(), sessionId, s.lat, s.lng, s.startTime, s.endTime),
    );
  }
  if (stmts.length === 0) return c.json({ ok: true, points: 0, stops: 0 });
  await c.env.DB.batch(stmts);
  return c.json({ ok: true, points: points.length, stops: stops.length });
});

// PATCH /track-sessions/:id — set ended_at (session owner only)
router.patch('/track-sessions/:id', async (c) => {
  const auth = await requireAuth(c);
  const sessionId = c.req.param('id');
  if (!(await ownsSession(c.env, sessionId, auth.id))) {
    throw new HTTPException(403, { message: 'session owner only' });
  }
  const body = await c.req.json<{ ended_at?: number }>();
  if (typeof body.ended_at !== 'number') {
    throw new HTTPException(400, { message: 'ended_at required' });
  }
  await c.env.DB.prepare('UPDATE track_sessions SET ended_at = ? WHERE id = ?')
    .bind(body.ended_at, sessionId)
    .run();
  return c.json({ ok: true });
});

// GET /track-sessions/:id — full session with points + stops (owner or campaign-admin)
router.get('/track-sessions/:id', async (c) => {
  const auth = await requireAuth(c);
  const sessionId = c.req.param('id');
  const session = await c.env.DB.prepare('SELECT * FROM track_sessions WHERE id = ?')
    .bind(sessionId)
    .first<{ id: string; campaign_id: string; walker_id: string; started_at: number; ended_at: number | null }>();
  if (!session) throw new HTTPException(404, { message: 'session not found' });

  const campaign = await c.env.DB.prepare('SELECT admin_ids FROM campaigns WHERE id = ?')
    .bind(session.campaign_id)
    .first<{ admin_ids: string }>();
  const adminIds = campaign ? (JSON.parse(campaign.admin_ids) as string[]) : [];
  if (session.walker_id !== auth.id && !adminIds.includes(auth.id)) {
    throw new HTTPException(403, { message: 'owner or campaign-admin only' });
  }

  const [points, stops] = await Promise.all([
    c.env.DB.prepare('SELECT t, lat, lng, speed FROM track_points WHERE session_id = ? ORDER BY t').bind(sessionId).all(),
    c.env.DB.prepare('SELECT lat, lng, start_time as startTime, end_time as endTime FROM track_stops WHERE session_id = ? ORDER BY start_time').bind(sessionId).all(),
  ]);
  return c.json({ ...session, points: points.results, stops: stops.results });
});

export default router;
