/**
 * Shared UTC date boundary helpers.
 * These functions compute boundaries in UTC to avoid locale/DST drift between server and client.
 */

/**
 * Start of current day (00:00:00.000 UTC)
 */
export function startOfUtcDay(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
}

/**
 * Start of current ISO week (Monday 00:00:00.000 UTC)
 * ISO week starts on Monday. This uses UTC math to avoid DST/locale issues.
 */
export function startOfUtcIsoWeek(now = new Date()): Date {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  const day = now.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const isoOffset = (day + 6) % 7; // Mon->0, Tue->1, ..., Sun->6
  const start = new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
  start.setUTCDate(start.getUTCDate() - isoOffset);
  return start;
}

/**
 * Start of current month (1st 00:00:00.000 UTC)
 */
export function startOfUtcMonth(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}
