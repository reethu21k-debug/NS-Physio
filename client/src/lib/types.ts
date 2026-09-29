export type PricingType = 'fixed' | 'starting_from' | 'contact';
export type AppointmentStatus = 'pending' | 'payment_submitted' | 'payment_verified' | 'confirmed' | 'rejected' | 'cancelled' | 'completed';
export type PaymentStatus = 'pending' | 'submitted' | 'verified' | 'rejected';

export interface Service {
  id: string; name: string; description: string; pricing_type: PricingType; price: number | null;
  duration_minutes: number; image_url: string | null; display_order: number; is_active?: boolean;
}
export interface PublicSettings {
  clinic_name: string; phone: string; email: string; address: string; about_text: string;
  morning_start: string; morning_end: string; evening_start: string; evening_end: string;
  slot_duration: number; timezone: string; cancellation_hours: number; booking_window_days: number;
}
export interface FullSettings extends PublicSettings { upi_id: string; upi_qr_url: string | null }
export interface Profile { id: string; full_name: string; email: string; phone: string | null; role: 'user' | 'admin' }
export interface PaymentInfo { id: string; status: PaymentStatus; screenshot_url: string | null; rejection_reason: string | null; submitted_at: string | null }
export interface Appointment {
  id: string; service_id: string; appointment_date: string; start_time: string; end_time: string; amount: number | null;
  payment_method: 'offline' | 'online'; payment_status: PaymentStatus; appointment_status: AppointmentStatus;
  notes: string | null; cancelled_by: string | null; created_at: string;
  service?: { name: string; duration_minutes: number } | null; payment?: PaymentInfo | null;
  events?: { event_type: string; new_status: string | null; created_at: string }[];
}
export interface Slot { start: string; end: string; period: 'morning' | 'evening'; state: 'available' | 'booked' | 'blocked' | 'past' }
export interface Availability { date: string; open: boolean; closedReason?: string; slots: Slot[] }
