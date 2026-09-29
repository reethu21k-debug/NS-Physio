import { addDays, fromMinutes, normTime, nowInZone, toMinutes } from './time.js';

export interface SettingsForSlots {
  morning_start: string; morning_end: string; evening_start: string; evening_end: string;
  slot_duration: number; timezone: string; booking_window_days: number;
}
export interface Occupied { start_time: string; end_time: string }
export interface Blocked { is_full_day: boolean; start_time: string | null; end_time: string | null }
export type SlotState = 'available' | 'booked' | 'blocked' | 'past';
export interface Slot { start: string; end: string; period: 'morning' | 'evening'; state: SlotState }

/** Generates the grid for both windows. A slot must fit fully inside its window. */
export function generateSlotGrid(s: SettingsForSlots, durationMinutes = s.slot_duration): Omit<Slot, 'state'>[] {
  const out: Omit<Slot, 'state'>[] = [];
  const windows: [string, string, 'morning' | 'evening'][] = [
    [s.morning_start, s.morning_end, 'morning'],
    [s.evening_start, s.evening_end, 'evening'],
  ];
  for (const [ws, we, period] of windows) {
    const start = toMinutes(ws), end = toMinutes(we);
    for (let t = start; t + durationMinutes <= end; t += s.slot_duration) {
      out.push({ start: fromMinutes(t), end: fromMinutes(t + durationMinutes), period });
    }
  }
  return out;
}

const overlaps = (aS: number, aE: number, bS: number, bE: number) => aS < bE && aE > bS;

/** Availability for one date. The DB re-validates everything at booking time. */
export function computeAvailability(
  date: string, s: SettingsForSlots, occupied: Occupied[], blocked: Blocked[],
  durationMinutes = s.slot_duration, now = new Date(),
): { date: string; open: boolean; closedReason?: string; slots: Slot[] } {
  const today = nowInZone(s.timezone, now);
  if (date < today.date) return { date, open: false, closedReason: 'past', slots: [] };
  if (date > addDays(today.date, s.booking_window_days)) return { date, open: false, closedReason: 'beyond_window', slots: [] };
  if (blocked.some((b) => b.is_full_day)) return { date, open: false, closedReason: 'closed', slots: [] };

  const slots = generateSlotGrid(s, durationMinutes).map((slot): Slot => {
    const a = toMinutes(slot.start), b = toMinutes(slot.end);
    let state: SlotState = 'available';
    if (date === today.date && a <= today.minutes) state = 'past';
    else if (blocked.some((x) => x.start_time && x.end_time && overlaps(a, b, toMinutes(x.start_time), toMinutes(x.end_time)))) state = 'blocked';
    else if (occupied.some((o) => overlaps(a, b, toMinutes(o.start_time), toMinutes(o.end_time)))) state = 'booked';
    return { ...slot, state };
  });
  return { date, open: true, slots };
}

/** Mirrors the DB's slot validation so the API can fail fast with friendly errors. */
export function isValidSlotStart(start: string, s: SettingsForSlots, durationMinutes: number): boolean {
  return generateSlotGrid(s, durationMinutes).some((x) => x.start === normTime(start));
}
