/**
 * Adjusts a date to the next weekday (Mon-Fri) if it falls on a weekend.
 * Sat → Mon, Sun → Mon
 */
export function ensureWeekday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  if (day === 0) d.setDate(d.getDate() + 1); // Sun → Mon
  if (day === 6) d.setDate(d.getDate() + 2); // Sat → Mon
  return d;
}

/**
 * Returns true if the date string (YYYY-MM-DD) falls on a weekday.
 */
export function isWeekday(dateStr: string): boolean {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  return day !== 0 && day !== 6;
}
