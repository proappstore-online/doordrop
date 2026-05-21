// Originally normalised Firestore Timestamp | Date → Date. On PAS the wire
// format is epoch ms (number), the repository layer hands callers a Date,
// and any stray `number` we'd see from sloppy callers we coerce safely.
export const timestampToDate = (value: Date | number | string | null | undefined): Date | null => {
  if (value == null) return null;
  if (value instanceof Date) return value;
  const d = new Date(value as number | string);
  return isNaN(d.getTime()) ? null : d;
};
