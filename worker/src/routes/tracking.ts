import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { campaignAccess, requireAssignedWalker, requireActiveCampaign } from '../auth.js';
import { batch, first, rows, run, type AppEnv, type Ctx, type Params } from '../pas.js';
import { newId } from '../lib.js';

const router = new Hono<AppEnv>();

interface SessionAccess { is_owner: number; is_campaign_admin: number }

function sessionAccess(c: Ctx, sessionId: string): Promise<SessionAccess | null> {
  return first<SessionAccess>(c, 'track_session_access', { id: sessionId });
}

async function requireSessionOwner(c: Ctx, sessionId: string): Promise<void> {
  if (!(await sessionAccess(c, sessionId))?.is_owner) {
    throw new HTTPException(403, { message: 'session owner only' });
  }
}

// POST /campaigns/:campaignId/track-sessions — start a new tracking session (assigned-walker)
router.post('/campaigns/:campaignId/track-sessions', async (c) => {
  const campaignId = c.req.param('campaignId');
  await requireActiveCampaign(c, campaignId);
  await requireAssignedWalker(c, campaignId);
  const id = newId();
  await run(c, 'start_track_session', { id, campaign_id: campaignId });
  return c.json({ id, started_at: Date.now() }, 201);
});

// GET /campaigns/:campaignId/track-sessions — campaign-admin, assigned-walker, or platform admin
router.get('/campaigns/:campaignId/track-sessions', async (c) => {
  const campaignId = c.req.param('campaignId');
  const access = await campaignAccess(c, campaignId);
  if (!access) throw new HTTPException(404, { message: 'campaign not found' });
  if (!access.is_admin && !access.is_walker && !access.is_platform_admin) {
    throw new HTTPException(403, { message: 'no access' });
  }
  return c.json(await rows(c, 'list_track_sessions', { campaign_id: campaignId }));
});

// POST /track-sessions/:id/append — batch insert points + stops (session owner only).
// Body: { points: [{t, lat, lng, speed?}, ...], stops: [{lat, lng, startTime, endTime}, ...] }
router.post('/track-sessions/:id/append', async (c) => {
  const sessionId = c.req.param('id');
  await requireSessionOwner(c, sessionId);
  const access = await sessionAccess(c, sessionId);
  if (!access) throw new HTTPException(404, { message: 'session not found' });
  // Check campaign status through the session
  const session = await first<{ campaign_id: string }>(c, 'get_track_session', { id: sessionId });
  if (!session) throw new HTTPException(404, { message: 'session not found' });
  await requireActiveCampaign(c, session.campaign_id);
  const body = await c.req.json<{
    points?: Array<{ t: number; lat: number; lng: number; speed?: number }>;
    stops?: Array<{ lat: number; lng: number; startTime: number; endTime: number }>;
  }>();
  const points = Array.isArray(body.points) ? body.points : [];
  const stops = Array.isArray(body.stops) ? body.stops : [];

  const calls: { name: string; params: Params }[] = [];
  for (const p of points) {
    if (typeof p.t !== 'number' || typeof p.lat !== 'number' || typeof p.lng !== 'number') continue;
    calls.push({ name: 'append_track_point', params: { session_id: sessionId, t: p.t, lat: p.lat, lng: p.lng, speed: p.speed } });
  }
  for (const s of stops) {
    if (typeof s.lat !== 'number' || typeof s.lng !== 'number'
        || typeof s.startTime !== 'number' || typeof s.endTime !== 'number') continue;
    calls.push({ name: 'append_track_stop', params: { session_id: sessionId, lat: s.lat, lng: s.lng, start_time: s.startTime, end_time: s.endTime } });
  }
  if (calls.length === 0) return c.json({ ok: true, points: 0, stops: 0 });
  await batch(c, calls);
  return c.json({ ok: true, points: points.length, stops: stops.length });
});

// PATCH /track-sessions/:id — set ended_at (session owner only)
router.patch('/track-sessions/:id', async (c) => {
  const sessionId = c.req.param('id');
  await requireSessionOwner(c, sessionId);
  const session = await first<{ campaign_id: string }>(c, 'get_track_session', { id: sessionId });
  if (!session) throw new HTTPException(404, { message: 'session not found' });
  await requireActiveCampaign(c, session.campaign_id);
  const body = await c.req.json<{ ended_at?: number }>();
  if (typeof body.ended_at !== 'number') {
    throw new HTTPException(400, { message: 'ended_at required' });
  }
  await run(c, 'end_track_session', { id: sessionId, ended_at: body.ended_at });
  return c.json({ ok: true });
});

// GET /track-sessions/:id — full session with points + stops (owner or campaign-admin)
router.get('/track-sessions/:id', async (c) => {
  const sessionId = c.req.param('id');
  const access = await sessionAccess(c, sessionId);
  if (!access) throw new HTTPException(404, { message: 'session not found' });
  if (!access.is_owner && !access.is_campaign_admin) {
    throw new HTTPException(403, { message: 'owner or campaign-admin only' });
  }
  const [session, points, stops] = await Promise.all([
    first(c, 'get_track_session', { id: sessionId }),
    rows(c, 'list_track_points', { session_id: sessionId }),
    rows(c, 'list_track_stops', { session_id: sessionId }),
  ]);
  return c.json({ ...session, points, stops });
});

export default router;
