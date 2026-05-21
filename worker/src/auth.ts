import { HTTPException } from 'hono/http-exception';
import type { Context } from 'hono';
import type { Env } from './env.js';

export interface FasUser {
  id: string;
  login: string;
}

const authCache = new Map<string, { user: FasUser; expires: number }>();
const AUTH_CACHE_TTL_MS = 60_000;

export async function requireAuth(c: Context<{ Bindings: Env }>): Promise<FasUser> {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: 'missing bearer token' });
  }
  const token = header.slice(7);

  const cached = authCache.get(token);
  if (cached && cached.expires > Date.now()) {
    return cached.user;
  }

  const fasBase = c.env.FAS_API_BASE || 'https://api.freeappstore.online';
  const response = await fetch(`${fasBase}/v1/auth/me`, {
    headers: { Authorization: header },
  });
  if (!response.ok) {
    authCache.delete(token);
    throw new HTTPException(401, { message: 'invalid session' });
  }
  const user = (await response.json()) as FasUser;

  authCache.set(token, { user, expires: Date.now() + AUTH_CACHE_TTL_MS });
  if (authCache.size > 100) {
    const now = Date.now();
    for (const [key, entry] of authCache) {
      if (entry.expires <= now) authCache.delete(key);
    }
  }

  return user;
}

export async function requireAdmin(c: Context<{ Bindings: Env }>): Promise<FasUser> {
  const user = await requireAuth(c);
  const row = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?')
    .bind(user.id)
    .first<{ role: string | null }>();
  if (row?.role !== 'admin') {
    throw new HTTPException(403, { message: 'admin required' });
  }
  return user;
}

export async function requireCampaignAdmin(
  c: Context<{ Bindings: Env }>,
  campaignId: string,
): Promise<FasUser> {
  const user = await requireAuth(c);
  const row = await c.env.DB.prepare('SELECT admin_ids FROM campaigns WHERE id = ?')
    .bind(campaignId)
    .first<{ admin_ids: string }>();
  if (!row) throw new HTTPException(404, { message: 'campaign not found' });
  const adminIds = JSON.parse(row.admin_ids) as string[];
  if (!adminIds.includes(user.id)) {
    throw new HTTPException(403, { message: 'campaign-admin required' });
  }
  return user;
}

export async function requireAssignedWalker(
  c: Context<{ Bindings: Env }>,
  campaignId: string,
): Promise<FasUser> {
  const user = await requireAuth(c);
  const row = await c.env.DB.prepare('SELECT assigned_walker_id FROM campaigns WHERE id = ?')
    .bind(campaignId)
    .first<{ assigned_walker_id: string | null }>();
  if (!row) throw new HTTPException(404, { message: 'campaign not found' });
  if (row.assigned_walker_id !== user.id) {
    throw new HTTPException(403, { message: 'assigned-walker required' });
  }
  return user;
}
