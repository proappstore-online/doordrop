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

export function now(): number {
  return Date.now();
}

export function newId(): string {
  return crypto.randomUUID();
}

export function propertyId(address: string, suburb: string, postcode: string): string {
  return `${address}|${suburb}|${postcode}`.toLowerCase().replace(/[/\\.\s]+/g, '_');
}

// Pull a subset of allowed fields from a request body. Anything else is dropped.
export function pick<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Partial<Pick<T, K>> {
  const out: Partial<Pick<T, K>> = {};
  for (const k of keys) {
    if (k in obj && obj[k] !== undefined) out[k] = obj[k];
  }
  return out;
}
