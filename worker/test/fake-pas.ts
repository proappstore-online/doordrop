/**
 * A `PasClient` that runs doordrop's registered actions (../../mcp.json) against
 * an in-memory SQLite built from ../../migrations, the way the platform runs
 * them on D1: parameters resolved by type, `:__user_id` bound to the caller,
 * batch tools and `actions.batch` in one transaction. So the tests exercise the
 * real action SQL — including the authz it carries — not a mock of it.
 */
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { PasClient } from '@proappstore/sdk/worker';

export interface ToolParam { type: string; optional?: boolean; default?: unknown }
export interface Tool {
  name: string;
  description: string;
  operation: 'query' | 'execute' | 'batch';
  sql?: string;
  statements?: string[];
  params?: Record<string, ToolParam>;
  requires_auth: boolean;
  auth?: { caller_unscoped?: { reason: string } };
  callers?: string[];
}

export const tools: Tool[] = JSON.parse(readFileSync(new URL('../../mcp.json', import.meta.url), 'utf8')).tools;
const byName = new Map(tools.map((t) => [t.name, t]));

export function toolStatements(tool: Tool): string[] {
  return tool.operation === 'batch' ? tool.statements ?? [] : [tool.sql ?? ''];
}

export function freshDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(readFileSync(new URL('../../migrations/0001_init.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../../migrations/0002_bookings.sql', import.meta.url), 'utf8'));
  return db;
}

// Mirrors the platform's resolveToolParams (packages/backend/src/lib/action-sql.ts).
function resolve(tool: Tool, input: Record<string, unknown>): Record<string, SQLInputValue> {
  const out: Record<string, SQLInputValue> = {};
  for (const [name, schema] of Object.entries(tool.params ?? {})) {
    let value = input[name];
    if (value === undefined || value === null) {
      if (schema.default !== undefined) value = schema.default;
      else if (schema.optional) value = null;
      else throw new Error(`BadRequest: "${tool.name}": Missing required parameter: ${name}`);
    }
    if (value !== null) {
      if (schema.type === 'integer' || schema.type === 'number') {
        value = Number(value);
        if (Number.isNaN(value) || (schema.type === 'integer' && !Number.isInteger(value))) {
          throw new Error(`BadRequest: "${tool.name}": ${name} must be a ${schema.type}`);
        }
      } else {
        value = String(value);
      }
    }
    out[name] = value as SQLInputValue;
  }
  return out;
}

function bind(sql: string, params: Record<string, SQLInputValue>, userId: string, now: number) {
  const values: SQLInputValue[] = [];
  const text = sql.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_m, name: string) => {
    if (name === '__user_id') values.push(userId);
    else if (name === '__now') values.push(now);
    else if (name === '__uuid') values.push(crypto.randomUUID());
    else if (name in params) values.push(params[name]!);
    else throw new Error(`Unresolved parameter: ${name}`);
    return '?';
  });
  return { text, values };
}

interface Result { rows: unknown[]; meta: { changes: number } }

function exec(db: DatabaseSync, userId: string, name: string, input: Record<string, unknown> = {}): Result[] {
  const tool = byName.get(name);
  if (!tool) throw new Error(`NotFound: action "${name}" is not registered`);
  if (!(tool.callers ?? ['user']).includes('user')) throw new Error(`Forbidden: "${name}" does not list "user" in its callers`);
  const params = resolve(tool, input);
  const now = Date.now();
  return toolStatements(tool).map((sql) => {
    const { text, values } = bind(sql, params, userId, now);
    const stmt = db.prepare(text);
    if (tool.operation === 'query') return { rows: stmt.all(...values), meta: { changes: 0 } };
    return { rows: [], meta: { changes: Number(stmt.run(...values).changes) } };
  });
}

function inTransaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

/** The PAS client a worker request gets when `userId` is signed in. */
export function fakePas(db: DatabaseSync, userId: string): PasClient {
  return {
    actions: {
      async call(name, params) {
        const tool = byName.get(name);
        const results = inTransaction(db, () => exec(db, userId, name, params));
        if (tool?.operation === 'batch') return { results };
        return tool?.operation === 'query' ? { rows: results[0]!.rows } : { meta: results[0]!.meta };
      },
      async batch(calls) {
        return inTransaction(db, () => calls.map((c) => ({ name: c.name, results: exec(db, userId, c.name, c.params) })));
      },
    },
    secrets: { get: async () => null },
    storage: { put: async () => { throw new Error('unused'); }, get: async () => null },
    log: async () => true,
  };
}
