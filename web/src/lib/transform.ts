// Wire format ↔ domain model translation.
//
// Worker returns/accepts: snake_case keys, dates as INTEGER epoch ms.
// Domain models use: camelCase keys, dates as Date.
//
// Anywhere a date field appears (by name from the DATE_FIELDS set) we coerce
// number↔Date at the boundary. Pages and models therefore see Date objects
// as the original DoorDrop code expected.

const DATE_FIELDS = new Set([
  'createdAt', 'updatedAt', 'lastLoggedInAt', 'completedAt', 'archivedAt',
  'dueDate', 'date', 'deliveredAt', 'reportedAt', 'lastReadAt',
  'startedAt', 'endedAt', 'startTime', 'endTime',
  'paidAt', 'mintedAt', 'agreedToTermsAt', 'anchorDate',
  // walker_review.created/updated already covered by createdAt/updatedAt
]);

function snakeToCamelKey(s: string): string {
  return s.replace(/_(\w)/g, (_, c: string) => c.toUpperCase());
}

function camelToSnakeKey(s: string): string {
  return s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
}

export function fromWire<T = unknown>(obj: unknown): T {
  if (obj === null || obj === undefined) return obj as T;
  if (Array.isArray(obj)) return obj.map((x) => fromWire(x)) as unknown as T;
  if (typeof obj !== 'object') return obj as T;

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const camel = snakeToCamelKey(k);
    if (DATE_FIELDS.has(camel) && typeof v === 'number') {
      out[camel] = new Date(v);
    } else if (v !== null && typeof v === 'object') {
      out[camel] = fromWire(v);
    } else {
      out[camel] = v;
    }
  }
  return out as T;
}

export function toWire<T = unknown>(obj: unknown): T {
  if (obj === null || obj === undefined) return obj as T;
  if (obj instanceof Date) return obj.getTime() as unknown as T;
  if (Array.isArray(obj)) return obj.map((x) => toWire(x)) as unknown as T;
  if (typeof obj !== 'object') return obj as T;

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (k === 'id') continue; // ids live in the URL, not the body
    out[camelToSnakeKey(k)] = toWire(v);
  }
  return out as T;
}
