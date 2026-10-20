// Originally normalised Firestore Timestamp | Date → Date. On PAS the wire
// format is epoch ms (number), the repository layer hands callers a Date,
// and any stray `number` we'd see from sloppy callers we coerce safely.
export const timestampToDate = (value: Date | number | string | null | undefined): Date | null => {
  if (value == null) return null;
  if (value instanceof Date) return value;
  const d = new Date(value as number | string);
  return isNaN(d.getTime()) ? null : d;
};

/**
 * Always returns a Date, for fields that may still hold a raw wire value (epoch ms or ISO string).
 * An invalid or missing value gives an Invalid Date, and null gives the epoch, as `new Date(value)` did.
 */
export const toDate = (value: Date | number | string | null | undefined): Date => {
  if (value instanceof Date) return value;
  return new Date(value === undefined ? NaN : value === null ? 0 : value);
};
