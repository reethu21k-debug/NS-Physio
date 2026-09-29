import { describe, it, expect } from 'vitest';
import { bookingSchema, serviceSchema, serviceUpdateSchema, settingsSchema, blockSchema, isRealDate } from '../lib/schemas.js';
import { sniffImage } from '../middleware/upload.js';
import { fromDbError } from '../lib/errors.js';

const uuid = '3f2b8c1e-5a4d-4c8e-9f1a-2b3c4d5e6f70';
describe('booking validation (price/status manipulation)', () => {
  const ok = { service_id: uuid, date: '2026-10-05', start_time: '10:30', payment_method: 'online' as const };
  it('accepts a valid request', () => expect(bookingSchema.safeParse(ok).success).toBe(true));
  it.each(['amount', 'price', 'payment_status', 'appointment_status', 'role', 'user_id'])('rejects client-supplied %s', (k) => {
    expect(bookingSchema.safeParse({ ...ok, [k]: 'x' }).success).toBe(false);
  });
  it('rejects malformed date/time/method', () => {
    expect(bookingSchema.safeParse({ ...ok, date: '05-10-2026' }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...ok, start_time: '25:00' }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...ok, payment_method: 'cash' }).success).toBe(false);
  });
});
describe('calendar date validation', () => {
  it('accepts real dates and rejects impossible ones', () => {
    expect(isRealDate('2026-02-28')).toBe(true);
    expect(isRealDate('2028-02-29')).toBe(true);
    expect(isRealDate('2026-02-29')).toBe(false);
    expect(isRealDate('2026-02-31')).toBe(false);
    expect(isRealDate('2026-13-01')).toBe(false);
  });
  it('booking schema rejects impossible dates (would otherwise reach Postgres as a 500)', () => {
    const b = { service_id: uuid, start_time: '10:30', payment_method: 'offline' as const };
    expect(bookingSchema.safeParse({ ...b, date: '2026-02-31' }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...b, date: '2026-10-05' }).success).toBe(true);
  });
});
describe('service PATCH schema', () => {
  it('a partial update carries no defaults, so untouched columns are never reset', () => {
    expect(serviceUpdateSchema.parse({ is_active: false })).toEqual({ is_active: false });
  });
  it('rejects unknown fields and bad values', () => {
    expect(serviceUpdateSchema.safeParse({ role: 'admin' }).success).toBe(false);
    expect(serviceUpdateSchema.safeParse({ price: 0 }).success).toBe(false);
    expect(serviceUpdateSchema.safeParse({ price: null, pricing_type: 'contact' }).success).toBe(true);
  });
});
describe('admin input validation', () => {
  it('service needs a price unless pricing_type is contact', () => {
    const base = { name: 'Test', description: '', duration_minutes: 30, is_active: true, display_order: 1 };
    expect(serviceSchema.safeParse({ ...base, pricing_type: 'fixed' }).success).toBe(false);
    expect(serviceSchema.safeParse({ ...base, pricing_type: 'fixed', price: 0 }).success).toBe(false);
    expect(serviceSchema.safeParse({ ...base, pricing_type: 'fixed', price: 499 }).success).toBe(true);
    expect(serviceSchema.safeParse({ ...base, pricing_type: 'contact', price: null }).success).toBe(true);
  });
  it('settings validates windows, timezone and UPI id', () => {
    expect(settingsSchema.safeParse({ morning_start: '13:00', morning_end: '09:00' }).success).toBe(false);
    expect(settingsSchema.safeParse({ timezone: 'Mars/Base' }).success).toBe(false);
    expect(settingsSchema.safeParse({ upi_id: 'bad id' }).success).toBe(false);
    expect(settingsSchema.safeParse({ upi_id: 'clinic@upi', timezone: 'Asia/Kolkata' }).success).toBe(true);
  });
  it('blocks need times unless full day', () => {
    expect(blockSchema.safeParse({ date: '2026-10-05', reason: 'Holiday' }).success).toBe(false);
    expect(blockSchema.safeParse({ date: '2026-10-05', reason: 'Holiday', full_day: true }).success).toBe(true);
  });
});
describe('file upload sniffing', () => {
  it('detects real image types by magic bytes', () => {
    expect(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...new Array(20).fill(0)]))).toBe('image/jpeg');
    expect(sniffImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(20).fill(0)]))).toBe('image/png');
    expect(sniffImage(Buffer.from('RIFF\0\0\0\0WEBPVP8 ' + 'x'.repeat(10)))).toBe('image/webp');
  });
  it('rejects HTML/SVG/exe disguised as images', () => {
    expect(sniffImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toBeNull();
    expect(sniffImage(Buffer.from('<html><body>hi</body></html>'))).toBeNull();
    expect(sniffImage(Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00'))).toBeNull();
  });
});
describe('db error mapping', () => {
  it('maps exclusion violations and RPC codes to a friendly 409', () => {
    expect(fromDbError({ code: '23P01', message: 'conflicting key' })).toMatchObject({ status: 409, code: 'SLOT_TAKEN' });
    expect(fromDbError({ message: 'SLOT_TAKEN' }).message).toContain('just booked by someone else');
  });
});
