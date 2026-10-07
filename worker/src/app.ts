import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { whoami } from './auth.js';
import { first, run, type AppEnv } from './pas.js';
import users, { hydrateUser } from './routes/users.js';
import campaigns from './routes/campaigns.js';
import doors from './routes/doors.js';
import printouts from './routes/printouts.js';
import flyers from './routes/flyers.js';
import properties from './routes/properties.js';
import interests from './routes/interests.js';
import reviews from './routes/reviews.js';
import history from './routes/history.js';
import notifications from './routes/notifications.js';
import notes from './routes/notes.js';
import tracking from './routes/tracking.js';
import config from './routes/config.js';
import deliveryRuns from './routes/deliveryRuns.js';

/**
 * doordrop's API, served at /.pas/worker/v1/* on the app origin. The platform
 * authenticates the user before the request gets here (same-origin session
 * cookie); `c.env.pas` runs registered actions as that user.
 */
export const app = new Hono<AppEnv>();

// Mount all /v1/* resource routers.
app.route('/v1', users);
app.route('/v1', campaigns);
app.route('/v1', doors);
app.route('/v1', printouts);
app.route('/v1', flyers);
app.route('/v1', properties);
app.route('/v1', interests);
app.route('/v1', reviews);
app.route('/v1', history);
app.route('/v1', notifications);
app.route('/v1', notes);
app.route('/v1', tracking);
app.route('/v1', config);
app.route('/v1', deliveryRuns);

// ---------------------------------------------------------------------------
// /v1/me — current user + role; signals first-time role-picker need.
// ---------------------------------------------------------------------------

app.get('/v1/me', async (c) => {
  const row = await first(c, 'get_me');
  if (!row) {
    // The platform user id is the only identity a worker sees; `login` kept for the wire shape.
    const { id } = await whoami(c);
    return c.json({ user: { id, login: id }, needsRoleSelection: true });
  }
  return c.json({ user: hydrateUser(row), needsRoleSelection: false });
});

// ---------------------------------------------------------------------------
// /v1/me/role — first-time role selection. Mirrors the firestore.rules guard
// "role can only be set on create, and only to client|walker (never admin)".
// ---------------------------------------------------------------------------

app.post('/v1/me/role', async (c) => {
  const body = await c.req.json<{ role?: string; email?: string; name?: string; photoUrl?: string }>();
  if (body.role !== 'client' && body.role !== 'walker') {
    throw new HTTPException(400, { message: "role must be 'client' or 'walker'" });
  }
  const created = await run(c, 'create_me', { role: body.role, email: body.email, name: body.name, photo_url: body.photoUrl });
  if (created === 0) throw new HTTPException(409, { message: 'role already set' });
  return c.json({ ok: true, role: body.role });
});

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  console.error('[doordrop-worker]', err);
  return c.json({ error: 'internal server error' }, 500);
});
