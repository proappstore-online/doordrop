import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { PasClient } from '@proappstore/sdk/worker';

/**
 * Data access for doordrop's app worker: every read and write is a registered
 * action (../../mcp.json) that the platform runs AS the signed-in user — the
 * worker has no database binding. Authz that SQL can express lives in the
 * actions themselves (`:__user_id` scoping), because a signed-in user can also
 * call them directly; the routes keep the cross-row checks and the error codes.
 */
export type AppEnv = { Bindings: { pas: PasClient } };
export type Ctx = Context<AppEnv>;
export type Params = Record<string, unknown>;
export type Row = Record<string, unknown>;

// PAS call errors arrive as "<Code>: <detail>" (Workers RPC keeps the message, not the class).
const STATUS: Record<string, 400 | 403 | 429 | 503> = {
  BadRequest: 400,
  Forbidden: 403,
  TooManyCalls: 429,
  Unavailable: 503,
};

async function pasCall<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const status = STATUS[message.split(':', 1)[0] ?? ''];
    if (status) throw new HTTPException(status, { message });
    throw e;
  }
}

/** Run one action and return the data worker's raw answer. */
export function call(c: Ctx, name: string, params: Params = {}): Promise<unknown> {
  return pasCall(() => c.env.pas.actions.call(name, params));
}

/** Run a query action; its rows. */
export async function rows<T = Row>(c: Ctx, name: string, params: Params = {}): Promise<T[]> {
  const res = (await call(c, name, params)) as { rows?: T[] };
  return res.rows ?? [];
}

/** Run a query action; its first row, or null. */
export async function first<T = Row>(c: Ctx, name: string, params: Params = {}): Promise<T | null> {
  return (await rows<T>(c, name, params))[0] ?? null;
}

/** Run an execute action; the number of rows it changed. */
export async function run(c: Ctx, name: string, params: Params = {}): Promise<number> {
  const res = (await call(c, name, params)) as { meta?: { changes?: number } };
  return res.meta?.changes ?? 0;
}

/** Many action calls in one transaction, chunked to the platform's 500-statement batch limit. */
export async function batch(c: Ctx, calls: { name: string; params: Params }[]): Promise<void> {
  for (let i = 0; i < calls.length; i += 500) {
    const chunk = calls.slice(i, i + 500);
    await pasCall(() => c.env.pas.actions.batch(chunk));
  }
}

/**
 * Broadcast a non-authoritative change notification after its D1 write commits.
 * A room is a delivery optimisation: callers must still load durable state on
 * initial mount and reconnect, and a failed broadcast must not fail the write.
 */
export async function publish(c: Ctx, roomId: string, event: Record<string, unknown>): Promise<void> {
  try {
    await c.env.pas.rooms.publish(roomId, event);
  } catch (e) {
    console.warn('[doordrop-worker] room publish failed', roomId, e);
  }
}

// Legacy route callers use this name. Keep the same loss-tolerant semantics
// while those consumers migrate to typed campaign events.
export const publishRoom = publish;
