export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message); }
}
const RPC_ERRORS: Record<string, [number, string]> = {
  SLOT_TAKEN: [409, 'That slot was just booked by someone else. Please select another time.'],
  SLOT_BLOCKED: [409, 'That time is not available. Please select another time.'],
  INVALID_SLOT: [400, 'That time is outside clinic hours or not a valid slot.'],
  PAST_DATE: [400, 'Appointments cannot be booked for past dates.'],
  PAST_TIME: [400, 'That time has already passed.'],
  BEYOND_BOOKING_WINDOW: [400, 'That date is too far in the future.'],
  SERVICE_UNAVAILABLE: [400, 'This service is not available.'],
  ONLINE_NOT_ALLOWED_FOR_CONTACT: [400, 'Online payment is not available for this service. Please pay at the clinic.'],
  USER_NOT_ALLOWED: [403, 'Your account cannot book appointments.'],
  INVALID_PAYMENT_METHOD: [400, 'Invalid payment method.'],
  HAS_LIVE_APPOINTMENTS: [409, 'There are active appointments in that period. Cancel them first.'],
};
/** Maps a Postgres/RPC error message to an HttpError. */
export function fromDbError(err: { message?: string; code?: string }): HttpError {
  const key = Object.keys(RPC_ERRORS).find((k) => err.message?.includes(k));
  if (key) { const [s, m] = RPC_ERRORS[key]!; return new HttpError(s, m, key); }
  if (err.code === '23P01') return new HttpError(409, RPC_ERRORS.SLOT_TAKEN![1], 'SLOT_TAKEN');
  if (err.code === '23503') return new HttpError(409, 'This record is referenced by other data and cannot be removed.');
  console.error('[db]', err);
  return new HttpError(500, 'Something went wrong. Please try again.');
}
