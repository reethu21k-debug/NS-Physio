import type { PricingType } from './types';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const formatDate = (d: string) => { const [y, m, day] = d.split('-').map(Number); return `${day} ${MONTHS[(m ?? 1) - 1]} ${y}`; };
export const formatTime = (t: string) => {
  const [h = 0, m = 0] = t.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
export const formatRupees = (n: number) => `₹${Number(n).toLocaleString('en-IN')}`;
export const formatAmount = (n: number | null) => (n === null ? 'To be confirmed at clinic' : formatRupees(n));
export const formatPrice = (type: PricingType, price: number | null) =>
  type === 'contact' || price === null ? 'Contact for pricing' : type === 'starting_from' ? `From ${formatRupees(price)}` : formatRupees(price);
export const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(iso));

/** Today's date (YYYY-MM-DD) in the clinic timezone — avoids browser-timezone date shifts. */
export function todayIn(tz: string): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return p;
}
export function addDays(date: string, n: number): string {
  const [y = 0, m = 1, d = 1] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
export const labelize = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

/** Cloudinary delivery optimisation (auto format/quality, capped width). */
export function optimizeImg(url: string | null | undefined, width = 800): string | undefined {
  if (!url) return undefined;
  return url.includes('/upload/') ? url.replace('/upload/', `/upload/f_auto,q_auto,w_${width}/`) : url;
}
