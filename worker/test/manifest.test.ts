// mcp.json must pass the platform's registration rules (packages/backend/src/routes/tools.ts)
// and compile against the schema — a rejected manifest fails the deploy before the upload.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { freshDb, toolStatements, tools } from './fake-pas.js';

const MAGIC = new Set(['__user_id', '__now', '__uuid']);
const placeholders = (sql: string) => [...sql.matchAll(/:([a-zA-Z_][a-zA-Z0-9_]*)/g)].map((m) => m[1]!);

describe('mcp.json', () => {
  it('has unique, well-formed tool names', () => {
    const names = tools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^[a-z][a-z0-9_]*$/);
  });

  for (const tool of tools) {
    describe(tool.name, () => {
      const statements = toolStatements(tool);

      it('is an authenticated, described action', () => {
        expect(tool.requires_auth).toBe(true);
        expect(tool.description.length).toBeGreaterThan(0);
      });

      it('is scoped to the caller or says why not', () => {
        const unscoped = tool.auth?.caller_unscoped?.reason?.trim();
        if (unscoped) return;
        for (const sql of statements) expect(sql).toContain(':__user_id');
      });

      it('passes the SQL lint and binds only declared params', () => {
        for (const sql of statements) {
          expect(sql).not.toContain(';');
          expect(sql).not.toMatch(/\b(CREATE|DROP|ALTER|PRAGMA|ATTACH|DETACH|VACUUM|REINDEX)\b/i);
          const verb = /^\s*(\w+)/.exec(sql)![1]!.toUpperCase();
          expect(['SELECT', 'INSERT', 'UPDATE', 'DELETE']).toContain(verb);
          expect(verb === 'SELECT').toBe(tool.operation === 'query');
          if (verb === 'UPDATE' || verb === 'DELETE') expect(sql.toUpperCase()).toContain('WHERE');
          for (const p of placeholders(sql)) expect(MAGIC.has(p) || p in (tool.params ?? {})).toBe(true);
          // D1 binds at most 100 parameters per statement.
          expect(placeholders(sql).length).toBeLessThanOrEqual(100);
        }
      });

      it('compiles against the schema', () => {
        const db = freshDb();
        for (const sql of statements) expect(() => db.prepare(sql.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, '?'))).not.toThrow();
      });
    });
  }

  it('declares every action the worker calls', () => {
    const dir = new URL('../src/', import.meta.url);
    const files = ['app.ts', 'auth.ts', ...readdirSync(new URL('routes/', dir)).map((f) => `routes/${f}`)];
    const used = new Set<string>();
    const literals = new Set<string>();
    for (const f of files) {
      const src = readFileSync(new URL(f, dir), 'utf8');
      for (const m of src.matchAll(/'([a-z_]+)'/g)) literals.add(m[1]!);
      for (const m of src.matchAll(/(?:rows|first|run|call)(?:<[^>]*>)?\(c, '([a-z_]+)'|name: '([a-z_]+)'|requireOwner\(c, '([a-z_]+)'/g)) {
        used.add((m[1] ?? m[2] ?? m[3])!);
      }
    }
    const declared = new Set(tools.map((t) => t.name));
    expect([...used].filter((n) => !declared.has(n))).toEqual([]);
    expect([...declared].filter((n) => !literals.has(n))).toEqual([]);
  });
});
