import { describe, it, expect } from 'vitest';
import { computeAvailability, generateSlotGrid, isValidSlotStart, type SettingsForSlots } from '../lib/slots.js';
import { calculateAmount, canPayOnline } from '../lib/pricing.js';
import { checkCancellation } from '../lib/cancellation.js';
import { canConfirm, canVerifyPayment, canCancel, canUploadProof } from '../lib/status.js';
import { addDays, nowInZone } from '../lib/time.js';

const S: SettingsForSlots = {
  morning_start: '09:00', morning_end: '13:00', evening_start: '16:00', evening_end: '21:00',
  slot_duration: 30, timezone: 'Asia/Kolkata', booking_window_days: 60,
};
// 2026-09-29 06:00 UTC = 11:30 IST
const NOW = new Date('2026-09-29T06:00:00Z');

describe('slot generation', () => {
  it('creates 8 morning + 10 evening 30-min slots', () => {
    const g = generateSlotGrid(S);
    expect(g.filter((x) => x.period === 'morning')).toHaveLength(8);
    expect(g.filter((x) => x.period === 'evening')).toHaveLength(10);
    expect(g[0]).toMatchObject({ start: '09:00', end: '09:30' });
    expect(g.at(-1)).toMatchObject({ start: '20:30', end: '21:00' });
  });
  it('respects changed settings and longer services', () => {
    expect(generateSlotGrid({ ...S, slot_duration: 60 })).toHaveLength(4 + 5);
    expect(generateSlotGrid(S, 60).at(-1)).toMatchObject({ start: '20:00', end: '21:00' });
  });
  it('validates slot starts', () => {
    expect(isValidSlotStart('09:30', S, 30)).toBe(true);
    expect(isValidSlotStart('09:15', S, 30)).toBe(false);
    expect(isValidSlotStart('13:00', S, 30)).toBe(false);
    expect(isValidSlotStart('20:45', S, 30)).toBe(false);
  });
});

describe('availability', () => {
  const date = '2026-10-05';
  it('marks booked and blocked slots and keeps others available', () => {
    const r = computeAvailability(date, S, [{ start_time: '10:00:00', end_time: '10:30:00' }],
      [{ is_full_day: false, start_time: '10:30', end_time: '11:30' }], 30, NOW);
    const st = (t: string) => r.slots.find((x) => x.start === t)?.state;
    expect(st('10:00')).toBe('booked');
    expect(st('10:30')).toBe('blocked');
    expect(st('11:00')).toBe('blocked');
    expect(st('11:30')).toBe('available');
  });
  it('a 60-minute service is unavailable if it would overlap a booking', () => {
    const r = computeAvailability(date, S, [{ start_time: '10:30', end_time: '11:00' }], [], 60, NOW);
    expect(r.slots.find((x) => x.start === '10:00')?.state).toBe('booked');
    expect(r.slots.find((x) => x.start === '11:00')?.state).toBe('available');
  });
  it('full-day closure hides all slots; past dates are closed', () => {
    expect(computeAvailability(date, S, [], [{ is_full_day: true, start_time: null, end_time: null }], 30, NOW).open).toBe(false);
    expect(computeAvailability('2026-09-28', S, [], [], 30, NOW)).toMatchObject({ open: false, closedReason: 'past' });
  });
  it("today's elapsed slots are 'past' using clinic timezone", () => {
    const r = computeAvailability('2026-09-29', S, [], [], 30, NOW);
    expect(r.slots.find((x) => x.start === '11:00')?.state).toBe('past');
    expect(r.slots.find((x) => x.start === '12:00')?.state).toBe('available');
  });
  it('booking window is enforced', () => {
    expect(computeAvailability(addDays('2026-09-29', 61), S, [], [], 30, NOW).closedReason).toBe('beyond_window');
  });
  it('clinic-local date does not shift near midnight UTC', () => {
    expect(nowInZone('Asia/Kolkata', new Date('2026-09-29T20:00:00Z')).date).toBe('2026-09-30');
  });
});

describe('pricing (server-derived)', () => {
  it('uses DB price for fixed and starting_from', () => {
    expect(calculateAmount({ pricing_type: 'fixed', price: 499 })).toBe(499);
    expect(calculateAmount({ pricing_type: 'starting_from', price: 299 })).toBe(299);
  });
  it('contact pricing has no amount and cannot be paid online', () => {
    expect(calculateAmount({ pricing_type: 'contact', price: null })).toBeNull();
    expect(canPayOnline({ pricing_type: 'contact', price: null })).toBe(false);
  });
  it('rejects zero/invalid priced services', () => {
    expect(() => calculateAmount({ pricing_type: 'fixed', price: 0 })).toThrow();
    expect(() => calculateAmount({ pricing_type: 'fixed', price: null })).toThrow();
  });
});

describe('cancellation', () => {
  const appt = { appointment_status: 'confirmed', payment_method: 'offline', payment_status: 'pending',
    appointment_date: '2026-09-29', start_time: '16:00:00' } as const;
  it('blocks users inside the window (11:30 IST → 16:00 is 4.5h away)', () => {
    expect(checkCancellation(appt, 4, S.timezone, 'user', NOW).allowed).toBe(true);
    expect(checkCancellation(appt, 6, S.timezone, 'user', NOW).allowed).toBe(false);
  });
  it('admins bypass the window; completed can never be cancelled', () => {
    expect(checkCancellation(appt, 48, S.timezone, 'admin', NOW).allowed).toBe(true);
    expect(checkCancellation({ ...appt, appointment_status: 'completed' }, 0, S.timezone, 'admin', NOW).allowed).toBe(false);
  });
});

describe('status rules (admin authorization of transitions)', () => {
  it('online payment must be verified before confirmation', () => {
    const a = { appointment_status: 'payment_submitted', payment_method: 'online', payment_status: 'submitted' } as const;
    expect(canConfirm(a)).toBe(false);
    expect(canVerifyPayment(a)).toBe(true);
    expect(canConfirm({ ...a, appointment_status: 'payment_verified', payment_status: 'verified' })).toBe(true);
  });
  it('rejected payment cannot be confirmed; user can re-upload', () => {
    const a = { appointment_status: 'pending', payment_method: 'online', payment_status: 'rejected' } as const;
    expect(canConfirm(a)).toBe(false);
    expect(canUploadProof(a)).toBe(true);
  });
  it('a rejected payment can never be verified or confirmed without a fresh submission', () => {
    const a = { appointment_status: 'pending', payment_method: 'online', payment_status: 'rejected' } as const;
    expect(canVerifyPayment(a)).toBe(false);
    expect(canConfirm(a)).toBe(false);
  });
  it('a submitted proof cannot be replaced until the admin rejects it', () => {
    expect(canUploadProof({ appointment_status: 'payment_submitted', payment_method: 'online', payment_status: 'submitted' })).toBe(false);
    expect(canUploadProof({ appointment_status: 'confirmed', payment_method: 'online', payment_status: 'verified' })).toBe(false);
  });
  it('offline has no payment verification; cancelled cannot be re-cancelled', () => {
    expect(canVerifyPayment({ appointment_status: 'pending', payment_method: 'offline', payment_status: 'pending' })).toBe(false);
    expect(canCancel({ appointment_status: 'cancelled', payment_method: 'offline', payment_status: 'pending' })).toBe(false);
  });
});
