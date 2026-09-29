import { zonedToEpoch, toMinutes } from './time.js';
import { canCancel, type ApptState } from './status.js';

export interface CancelCheck { allowed: boolean; reason?: string }

/** Users may cancel until `cancellationHours` before start. Admins bypass the time window (not the status rules). */
export function checkCancellation(
  appt: ApptState & { appointment_date: string; start_time: string },
  cancellationHours: number, timezone: string, by: 'user' | 'admin', now = new Date(),
): CancelCheck {
  if (appt.appointment_status === 'completed') return { allowed: false, reason: 'Completed appointments cannot be cancelled.' };
  if (!canCancel(appt)) return { allowed: false, reason: 'This appointment can no longer be cancelled.' };
  if (by === 'admin') return { allowed: true };
  const startMs = zonedToEpoch(appt.appointment_date, toMinutes(appt.start_time), timezone);
  if (startMs - now.getTime() < cancellationHours * 3600_000) {
    return { allowed: false, reason: `Appointments can only be cancelled at least ${cancellationHours} hours before the start time.` };
  }
  return { allowed: true };
}
