/** Time helpers. Times are "HH:MM" strings, dates are "YYYY-MM-DD" strings (clinic-local, no JS Date shifting). */
export const toMinutes = (t: string): number => {
  const [h = '0', m = '0'] = t.split(':');
  return Number(h) * 60 + Number(m);
};
export const fromMinutes = (n: number): string =>
  `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
export const normTime = (t: string): string => t.slice(0, 5);

/** Current local date + minutes-since-midnight in an IANA timezone. */
export function nowInZone(tz: string, now = new Date()): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '0';
  return { date: `${g('year')}-${g('month')}-${g('day')}`, minutes: Number(g('hour')) * 60 + Number(g('minute')) };
}

/** Adds days to a YYYY-MM-DD string using UTC math (timezone-safe). */
export function addDays(date: string, days: number): string {
  const [y = 0, m = 1, d = 1] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Epoch ms of a clinic-local date+minutes (used for cancellation windows). Assumes fixed-offset zones (India: +05:30). */
export function zonedToEpoch(date: string, minutes: number, tz: string): number {
  const [y = 0, mo = 1, d = 1] = date.split('-').map(Number);
  const guess = Date.UTC(y, mo - 1, d, 0, minutes);
  const seen = nowInZone(tz, new Date(guess));
  const seenMs = Date.UTC(
    Number(seen.date.slice(0, 4)), Number(seen.date.slice(5, 7)) - 1, Number(seen.date.slice(8, 10)), 0, seen.minutes);
  return guess - (seenMs - guess);
}
