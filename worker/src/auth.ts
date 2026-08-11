import { HTTPException } from 'hono/http-exception';
import type { Context } from 'hono';
import type { Env } from './env.js';

/**
 * Session auth for doordrop's worker.
 *
 * WAS: a round-trip to FreeAppStore — `GET api.freeappstore.online/v1/auth/me`
 * with the caller's bearer, plus a Map cache of raw tokens. Three problems:
 *
 *  1. Wrong platform. doordrop is a PAS app; a PAS session is not a FAS session,
 *     so this only worked because the two happened to share an identity
 *     provider. It is a cross-store runtime dependency, which the workspace
 *     rules forbid — PAS must stand alone.
 *  2. Blocks the platform-cookie migration (#71/#20). Under mediation the host
 *     forwards a PAS session; asking FAS about it fails.
 *  3. An auth round-trip on every uncached request, and a cache keyed on the
 *     raw token — a credential sitting in worker memory for a minute.
 *
 * NOW: verify the PAS session JWT locally with SESSION_SIGNING_KEY. Ported from
 * the platform data-worker (`packages/data-worker/src/index.ts`), which solves
 * exactly this for every provisioned app. No network call, so no cache: an HMAC
 * over a short string is cheaper than the Map lookup it would replace.
 *
 * TOKEN SHAPE: PAS sessions are `<base64url body>.<base64url sig>` — two parts,
 * NOT a standard three-part JWT. Signature is HMAC-SHA256 over the body.
 */

export interface FasUser {
  id: string;
  login: string;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

/**
 * Verify a PAS session token and return its claims, or null.
 *
 * Never throws — a malformed token is indistinguishable from a forged one as
 * far as the caller is concerned, and both must simply fail.
 */
async function verifySessionLocal(
  token: string,
  signingKey: string,
): Promise<{ uid: string; login: string } | null> {
  try {
    const dot = token.lastIndexOf('.');
    if (dot < 0) return null;
    const body = token.slice(0, dot);
    const sig = token.slice(dot + 1);

    const key = await crypto.subtle.importKey(
      'raw', enc.encode(signingKey) as BufferSource,
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    );
    const expected = new Uint8Array(
      await crypto.subtle.sign('HMAC', key, enc.encode(body) as BufferSource),
    );
    let b = '';
    for (const byte of expected) b += String.fromCharCode(byte);
    const expectedStr = btoa(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    // Constant-time compare: a length check short-circuits, but the byte loop
    // must not, or timing leaks how much of a forged signature was right.
    if (sig.length !== expectedStr.length) return null;
    let diff = 0;
    for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expectedStr.charCodeAt(i);
    if (diff !== 0) return null;

    const padded = body.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((body.length + 3) % 4);
    const json = dec.decode(Uint8Array.from(atob(padded), (ch) => ch.charCodeAt(0)));
    const claims = JSON.parse(json) as { uid?: string; login?: string; exp?: number };

    if (!claims.uid) return null;
    // Expiry is not optional: a token with no `exp` would never age out.
    if (typeof claims.exp !== 'number' || claims.exp < Math.floor(Date.now() / 1000)) return null;

    return { uid: claims.uid, login: claims.login ?? claims.uid };
  } catch {
    return null;
  }
}

export async function requireAuth(c: Context<{ Bindings: Env }>): Promise<FasUser> {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: 'missing bearer token' });
  }
  if (!c.env.SESSION_SIGNING_KEY) {
    // Fail closed. Without the key every token would verify as invalid anyway;
    // saying so plainly turns a confusing wall of 401s into one clear cause.
    throw new HTTPException(500, { message: 'SESSION_SIGNING_KEY is not configured' });
  }

  const claims = await verifySessionLocal(header.slice(7), c.env.SESSION_SIGNING_KEY);
  if (!claims) {
    throw new HTTPException(401, { message: 'invalid session' });
  }

  // `uid` is the platform user id (`gh:<github id>`) — the same value the FAS
  // round-trip returned as `id`, since both stores derive it from the GitHub
  // account. Existing rows keyed on it stay valid.
  return { id: claims.uid, login: claims.login };
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
