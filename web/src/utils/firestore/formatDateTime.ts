// Format helpers — accept Date, epoch ms, or ISO string. No more Firestore
// Timestamp branch: the repository layer already hands callers Date objects.

export const formatDateTime = (
  value: Date | number | string | null | undefined,
): string => {
  if (value == null) return 'Unknown';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return 'Unknown';
  return d.toLocaleString();
};

export const formatDate = (
  value: Date | number | string | null | undefined,
): string => {
  if (value == null) return 'N/A';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString();
};
