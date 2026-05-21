import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import type { Env } from './env.js';
import { requireAuth, requireAdmin } from './auth.js';
import users from './routes/users.js';
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

const app = new Hono<{ Bindings: Env }>();

app.use(
  '*',
  cors({
    origin: (origin) => {
      if (!origin) return null;
      try {
        const host = new URL(origin).hostname.toLowerCase();
        if (host === 'localhost' || host === '127.0.0.1') return origin;
        if (host.endsWith('.proappstore.online') || host === 'proappstore.online') return origin;
        if (host.endsWith('.pages.dev')) return origin;
        return null;
      } catch {
        return null;
      }
    },
    allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type'],
    maxAge: 600,
  }),
);

app.get('/health', (c) => c.json({ ok: true, app: c.env.APP_ID }));

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

// ---------------------------------------------------------------------------
// /v1/me — current user + role; signals first-time role-picker need.
// ---------------------------------------------------------------------------

app.get('/v1/me', async (c) => {
  const fasUser = await requireAuth(c);
  const row = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
    .bind(fasUser.id)
    .first<Record<string, unknown>>();

  if (!row) {
    return c.json({
      user: { id: fasUser.id, login: fasUser.login },
      needsRoleSelection: true,
    });
  }
  // Hydrate JSON columns so the client receives parsed shapes (matches
  // routes/users.ts behaviour).
  const parsed = {
    ...row,
    client_profile: typeof row.client_profile === 'string' ? JSON.parse(row.client_profile) : null,
    walker_profile: typeof row.walker_profile === 'string' ? JSON.parse(row.walker_profile) : null,
    delivery_photos: typeof row.delivery_photos === 'string' ? JSON.parse(row.delivery_photos) : null,
  };
  return c.json({ user: parsed, needsRoleSelection: false });
});

// ---------------------------------------------------------------------------
// /v1/me/role — first-time role selection. Mirrors the firestore.rules guard
// "role can only be set on create, and only to client|walker (never admin)".
// ---------------------------------------------------------------------------

app.post('/v1/me/role', async (c) => {
  const fasUser = await requireAuth(c);
  const body = await c.req.json<{ role?: string; email?: string; name?: string; photoUrl?: string }>();

  if (body.role !== 'client' && body.role !== 'walker') {
    throw new HTTPException(400, { message: "role must be 'client' or 'walker'" });
  }

  const existing = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?')
    .bind(fasUser.id)
    .first<{ role: string }>();

  if (existing) {
    throw new HTTPException(409, { message: 'role already set' });
  }

  const now = Date.now();
  await c.env.DB.prepare(
    `INSERT INTO users (id, email, name, photo_url, role, created_at, last_logged_in_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      fasUser.id,
      body.email ?? null,
      body.name ?? fasUser.login,
      body.photoUrl ?? null,
      body.role,
      now,
      now,
    )
    .run();

  return c.json({ ok: true, role: body.role });
});

// ---------------------------------------------------------------------------
// Admin-only dev/migration gateway (preserves the platform data-worker's
// useful endpoints for schema migrations + ad-hoc queries from local tools,
// but gated to admin role so any signed-in user can't run arbitrary SQL).
// ---------------------------------------------------------------------------

app.get('/tables', async (c) => {
  await requireAdmin(c);
  const result = await c.env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name",
  ).all<{ name: string }>();
  return c.json(result.results.map((r) => r.name));
});

interface SqlPayload {
  sql: string;
  params?: unknown[];
}

function validateSql(body: unknown): SqlPayload {
  const obj = body as Record<string, unknown>;
  if (typeof obj.sql !== 'string' || obj.sql.trim() === '') {
    throw new HTTPException(400, { message: 'sql must be a non-empty string' });
  }
  if (obj.params !== undefined && !Array.isArray(obj.params)) {
    throw new HTTPException(400, { message: 'params must be an array' });
  }
  const payload: SqlPayload = { sql: obj.sql };
  if (Array.isArray(obj.params)) payload.params = obj.params;
  return payload;
}

app.post('/query', async (c) => {
  await requireAdmin(c);
  const body = await c.req.json();
  const { sql, params } = validateSql(body);
  const start = Date.now();
  const stmt = params ? c.env.DB.prepare(sql).bind(...params) : c.env.DB.prepare(sql);
  const result = await stmt.all();
  return c.json({
    rows: result.results,
    meta: { changes: result.meta.changes, duration: Date.now() - start },
  });
});

app.post('/execute', async (c) => {
  await requireAdmin(c);
  const body = await c.req.json();
  const { sql, params } = validateSql(body);
  const start = Date.now();
  const stmt = params ? c.env.DB.prepare(sql).bind(...params) : c.env.DB.prepare(sql);
  const result = await stmt.run();
  return c.json({
    meta: {
      changes: result.meta.changes,
      duration: Date.now() - start,
      last_row_id: result.meta.last_row_id,
    },
  });
});

app.post('/batch', async (c) => {
  await requireAdmin(c);
  const body = await c.req.json<{ statements: unknown[] }>();
  if (!Array.isArray(body.statements) || body.statements.length === 0) {
    throw new HTTPException(400, { message: 'statements must be a non-empty array' });
  }
  const stmts = body.statements.map((raw) => {
    const { sql, params } = validateSql(raw);
    return params ? c.env.DB.prepare(sql).bind(...params) : c.env.DB.prepare(sql);
  });
  const results = await c.env.DB.batch(stmts);
  return c.json({
    results: results.map((r) => ({
      rows: r.results,
      meta: { changes: r.meta.changes, last_row_id: r.meta.last_row_id },
    })),
  });
});

app.post('/migrate', async (c) => {
  await requireAdmin(c);
  const body = await c.req.json<{ migrations: { name: string; sql: string }[] }>();
  if (!Array.isArray(body.migrations) || body.migrations.length === 0) {
    throw new HTTPException(400, { message: 'migrations must be a non-empty array of {name, sql}' });
  }

  await c.env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    )`,
  ).run();

  const applied = await c.env.DB.prepare('SELECT name FROM _migrations').all<{ name: string }>();
  const appliedSet = new Set(applied.results.map((r) => r.name));

  const ran: string[] = [];
  for (const m of body.migrations) {
    if (appliedSet.has(m.name)) continue;
    const stripped = m.sql
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .map((line) => line.replace(/--.*$/, ''))
      .join('\n');
    const statements = stripped.split(';').map((s) => s.trim()).filter((s) => s.length > 0);
    for (const stmt of statements) {
      await c.env.DB.prepare(stmt).run();
    }
    await c.env.DB.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)')
      .bind(m.name, Date.now())
      .run();
    ran.push(m.name);
  }

  return c.json({ applied: ran, already: [...appliedSet] });
});

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  console.error('Unhandled error:', err);
  return c.json({ error: 'internal server error' }, 500);
});

export default app;
