/**
 * Normalises an Indian mobile number to E.164 (+91XXXXXXXXXX). Returns null if it is not a valid one.
 * Accepts: 9876543210, 09876543210, 919876543210, +91 98765 43210, +91-98765-43210.
 * Keep identical to normalize_in_phone() in supabase/0006_phone_login.sql and the server copy.
 */
export function normalizeIndianPhone(raw: string): string | null {
  const s = raw.trim();
  if (!/^\+?[\d\s\-()]+$/.test(s)) return null;
  let d = s.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? `+91${d}` : null;
}