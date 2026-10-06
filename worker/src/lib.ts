export function toJson(v: unknown): string | null {
  if (v == null) return null;
  return JSON.stringify(v);
}

export function fromJson<T>(s: string | null | undefined, fallback: T): T {
  if (s == null || s === '') return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export function newId(): string {
  return crypto.randomUUID();
}

export function propertyId(address: string, suburb: string, postcode: string): string {
  return `${address}|${suburb}|${postcode}`.toLowerCase().replace(/[/\\.\s]+/g, '_');
}

/** The allowed keys of a request body that are present (null included). */
export function pickDefined(body: Record<string, unknown>, allowed: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of allowed) if (body[k] !== undefined) out[k] = body[k];
  return out;
}
