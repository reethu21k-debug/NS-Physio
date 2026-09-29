import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, errMsg } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { useToast } from '../../lib/toast';
import { formatAmount, formatDate, formatDateTime, formatTime, labelize } from '../../lib/format';
import type { Appointment, PublicSettings } from '../../lib/types';
import { PaymentPanel } from '../../components/PaymentPanel';
import { Button, ConfirmDialog, ErrorState, PageTitle, Spinner, StatusBadge } from '../../components/ui';

export const Detail = ({ k, v }: { k: string; v: React.ReactNode }) => (<div className="flex justify-between gap-4 border-b border-gray-100 py-2 text-sm last:border-0"><dt className="text-gray-500">{k}</dt><dd className="text-right font-medium">{v}</dd></div>);

export default function AppointmentDetail() {
  const { id } = useParams();
  const toast = useToast();
  const q = useAsync(() => api<Appointment>(`/appointments/${id}`), [id]);
  const clinic = useAsync(() => api<PublicSettings>('/settings'));
  const [confirm, setConfirm] = useState(false); const [busy, setBusy] = useState(false);
  const a = q.data;
  async function cancel() {
    setBusy(true);
    try { await api(`/appointments/${id}/cancel`, { method: 'POST', body: {} }); toast.success('Appointment cancelled.'); setConfirm(false); await q.reload(); }
    catch (e) { toast.error(errMsg(e)); setConfirm(false); } finally { setBusy(false); }
  }
  if (q.loading && !a) return <Spinner />;
  if (q.error || !a) return <ErrorState message={q.error ?? 'Appointment not found.'} onRetry={() => void q.reload()} />;
  const active = !['cancelled', 'rejected', 'completed'].includes(a.appointment_status);
  return (
    <>
      <PageTitle title="Appointment Details" subtitle={`ID: ${a.id.slice(0, 8).toUpperCase()}`} action={<Link to="/appointments" className="text-sm text-navy underline">← All appointments</Link>} />
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="card" aria-label="Appointment summary"><dl>
          <Detail k="Service" v={a.service?.name} /><Detail k="Date" v={formatDate(a.appointment_date)} /><Detail k="Time" v={`${formatTime(a.start_time)} – ${formatTime(a.end_time)}`} />
          <Detail k="Duration" v={`${a.service?.duration_minutes ?? ''} min`} /><Detail k="Amount" v={formatAmount(a.amount)} />
          <Detail k="Payment method" v={a.payment_method === 'online' ? 'Online payment' : 'Pay at clinic'} />
          <Detail k="Payment status" v={<StatusBadge status={a.payment_status} />} /><Detail k="Appointment status" v={<StatusBadge status={a.appointment_status} />} />
          {a.cancelled_by && <Detail k="Cancelled by" v={a.cancelled_by === 'cancelled_by_admin' ? 'Clinic' : 'You'} />}
          {a.notes && <Detail k="Notes" v={a.notes} />}
        </dl>
          {active && <div className="mt-4"><Button variant="outline" onClick={() => setConfirm(true)}>Cancel Appointment</Button>
            {clinic.data && <p className="mt-2 text-xs text-gray-500">Cancellation is allowed until {clinic.data.cancellation_hours} hours before the appointment.</p>}</div>}
        </section>
        <div className="space-y-6">
          {a.payment_method === 'online' && !['cancelled', 'rejected'].includes(a.appointment_status) && <PaymentPanel appt={a} onDone={() => void q.reload()} />}
          {clinic.data && <section className="card text-sm"><h2 className="mb-2 text-lg">Clinic</h2><p className="font-semibold">{clinic.data.clinic_name}</p>
            {clinic.data.address && <p>{clinic.data.address}</p>}{clinic.data.phone && <p>Phone: {clinic.data.phone}</p>}</section>}
          {!!a.events?.length && <section className="card"><h2 className="mb-2 text-lg">History</h2><ol className="space-y-1 text-sm">{a.events.map((e, i) => <li key={i} className="flex justify-between gap-2"><span>{labelize(e.event_type.toLowerCase())}</span><span className="text-gray-500">{formatDateTime(e.created_at)}</span></li>)}</ol></section>}
        </div>
      </div>
      <ConfirmDialog open={confirm} title="Cancel this appointment?" message="This will free up the time slot. This cannot be undone." confirmLabel="Yes, cancel" danger loading={busy} onConfirm={cancel} onClose={() => setConfirm(false)} />
    </>
  );
}
