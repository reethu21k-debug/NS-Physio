export type AppointmentStatus = 'pending' | 'payment_submitted' | 'payment_verified' | 'confirmed' | 'rejected' | 'cancelled' | 'completed';
export type PaymentStatus = 'pending' | 'submitted' | 'verified' | 'rejected';
export type PaymentMethod = 'offline' | 'online';
export interface ApptState { appointment_status: AppointmentStatus; payment_method: PaymentMethod; payment_status: PaymentStatus }

const LIVE: AppointmentStatus[] = ['pending', 'payment_submitted', 'payment_verified', 'confirmed'];

export const canVerifyPayment = (a: ApptState) =>
  a.payment_method === 'online' && a.payment_status === 'submitted' && LIVE.includes(a.appointment_status);
export const canRejectPayment = canVerifyPayment;
export const canConfirm = (a: ApptState) =>
  a.payment_method === 'offline'
    ? a.appointment_status === 'pending'
    : a.appointment_status === 'payment_verified' && a.payment_status === 'verified';
export const canComplete = (a: ApptState) => a.appointment_status === 'confirmed';
export const canCancel = (a: ApptState) => LIVE.includes(a.appointment_status);
export const canUploadProof = (a: ApptState) =>
  a.payment_method === 'online' && ['pending', 'rejected'].includes(a.payment_status) && LIVE.includes(a.appointment_status) && a.appointment_status !== 'confirmed';
