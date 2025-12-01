export function transformDateString(value): Date {
  if (value instanceof Date) return value;
  const parsedDate = new Date(String(value));
  return isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
}

export function parseInteger(value): number {
  if (typeof value === 'number') return value;
  const parsed = parseInt(String(value), 10);
  return isNaN(parsed) ? 0 : parsed;
}
