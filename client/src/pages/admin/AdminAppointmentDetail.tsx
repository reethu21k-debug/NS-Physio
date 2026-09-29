import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, errMsg } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { useToast } from '../../lib/toast';
import { formatAmount, formatDate, formatDateTime, formatTime, labelize } from '../../lib/format';
import type { Appointment, PaymentInfo } from '../../lib/types';
import { Button, ConfirmDialog, ErrorState, Modal, PageTitle, Spinner, StatusBadge, Textarea } from '../../components/ui';
import { ProofImage } from '../../components/ProofImage';
import { Detail } from '../user/AppointmentDetail';

interface AdminAppt extends Omit<Appointment, 'payment'> {
  customer: { full_name: string; email: string; phone: string | null };
  payment: (PaymentInfo & { id: string }) | null;
  actions: { verify_payment: boolean; reject_payment: boolean; confirm: boolean; approve: boolean; cancel: boolean; complete: boolean };
}
type Act = 'confirm' | 'cancel' | 'complete' | 'verify' | null;

export default function AdminAppointmentDetail() {
  const { id } = useParams(); const toast = useToast();
  const q = useAsync(() => api<AdminAppt>(`/admin/appointments/${id}`), [id]);
  const [act, setAct] = useState<Act>(null); const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false); const [reason, setReason] = useState('');
  const a = q.data;
  if (q.loading && !a) return <Spinner />;
  if (q.error || !a) return <ErrorState message={q.error ?? 'Not found'} onRetry={() => void q.reload()} />;

  async function run(path: string, body: unknown, ok: string) {
    setBusy(true);
    try { await api(path, { method: 'POST', body }); toast.success(ok); setAct(null); setRejectOpen(false); setReason(''); await q.reload(); }
    catch (e) { toast.error(errMsg(e)); setAct(null); } finally { setBusy(false); }
  }
  const A = a.actions;
  const CONFIG: Record<Exclude<Act, null>, { title: string; msg: string; label: string; danger?: boolean; go: () => void }> = {
    confirm: {
      title: A.approve ? 'Approve and confirm?' : 'Confirm appointment?',
      msg: A.approve ? 'This verifies the submitted payment and confirms the appointment. The customer will be emailed.' : 'The customer will be emailed a confirmation.',
      label: A.approve ? 'Approve & Confirm' : 'Confirm Appointment', go: () => void run(`/admin/appointments/${id}/confirm`, {}, 'Appointment confirmed.'),
    },
    cancel: { title: 'Cancel appointment?', msg: 'The slot will become available again and the customer will be notified.', label: 'Cancel Appointment', danger: true, go: () => void run(`/admin/appointments/${id}/cancel`, {}, 'Appointment cancelled.') },
    complete: { title: 'Mark as completed?', msg: 'This records the visit as completed.', label: 'Mark Completed', go: () => void run(`/admin/appointments/${id}/complete`, {}, 'Appointment marked completed.') },
    verify: { title: 'Verify this payment?', msg: 'Confirm you have seen the payment in your account.', label: 'Verify Payment', go: () => void run(`/payments/${a.payment!.id}/verify`, {}, 'Payment verified.') },
  };
  const c = act ? CONFIG[act] : null;
  const canConfirmNow = A.confirm || A.approve;
  return (
    <>
      <PageTitle title="Appointment" subtitle={`ID: ${a.id.toUpperCase()}`} action={<Link to="/admin/appointments" className="text-sm text-navy underline">← All appointments</Link>} />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <section className="card"><h2 className="mb-2 text-lg">Customer</h2><dl><Detail k="Name" v={a.customer.full_name} /><Detail k="Email" v={a.customer.email} /><Detail k="Phone" v={a.customer.phone || '—'} /></dl></section>
          <section className="card"><h2 className="mb-2 text-lg">Appointment</h2><dl>
            <Detail k="Service" v={a.service?.name} /><Detail k="Date" v={formatDate(a.appointment_date)} /><Detail k="Time" v={`${formatTime(a.start_time)} – ${formatTime(a.end_time)}`} />
            <Detail k="Duration" v={`${a.service?.duration_minutes} min`} /><Detail k="Amount" v={formatAmount(a.amount)} /><Detail k="Status" v={<StatusBadge status={a.appointment_status} />} />
            <Detail k="Booked on" v={formatDateTime(a.created_at)} />
            {a.notes && <Detail k="Customer notes" v={a.notes} />}</dl></section>
          <section className="card"><h2 className="mb-2 text-lg">Actions</h2>
            <div className="flex flex-wrap gap-2">
              {canConfirmNow && <Button variant="gold" onClick={() => setAct('confirm')}>{A.approve ? 'Approve & Confirm' : 'Confirm Appointment'}</Button>}
              {A.verify_payment && <Button variant="outline" onClick={() => setAct('verify')}>Verify Payment only</Button>}
              {A.reject_payment && <Button variant="danger" onClick={() => setRejectOpen(true)}>Reject Payment</Button>}
              {A.complete && <Button variant="outline" onClick={() => setAct('complete')}>Mark Completed</Button>}
              {A.cancel && <Button variant="outline" onClick={() => setAct('cancel')}>Cancel Appointment</Button>}
              {!Object.values(A).some(Boolean) && <p className="text-sm text-gray-500">No further actions available.</p>}
            </div>
            {a.payment_method === 'online' && !canConfirmNow && ['pending', 'payment_submitted'].includes(a.appointment_status) && a.payment_status !== 'submitted' && <p className="mt-3 text-xs text-gray-500">Waiting for the customer to upload a payment screenshot before this can be confirmed.</p>}</section>
        </div>
        <div className="space-y-6">
          <section className="card"><h2 className="mb-2 text-lg">Payment</h2><dl>
            <Detail k="Method" v={a.payment_method === 'online' ? 'Online (UPI)' : 'Pay at clinic'} /><Detail k="Payment status" v={<StatusBadge status={a.payment_status} />} />
            {a.payment?.submitted_at && <Detail k="Screenshot submitted" v={formatDateTime(a.payment.submitted_at)} />}
            {a.payment?.rejection_reason && <Detail k="Rejection reason" v={a.payment.rejection_reason} />}</dl>
            {a.payment_method === 'online' && (
              <div className="mt-4"><h3 className="mb-2 font-sans text-sm font-semibold">Payment screenshot</h3>
                {a.payment?.submitted_at
                  ? <ProofImage key={a.payment.submitted_at} appointmentId={a.id} />
                  : <p className="rounded-lg bg-gray-100 p-4 text-sm text-gray-600">No screenshot uploaded yet.</p>}
              </div>)}</section>
          {!!a.events?.length && <section className="card"><h2 className="mb-2 text-lg">Audit history</h2><ol className="space-y-1 text-sm">{a.events.map((e, i) => <li key={i} className="flex justify-between gap-2"><span>{labelize(e.event_type.toLowerCase())}</span><span className="text-gray-500">{formatDateTime(e.created_at)}</span></li>)}</ol></section>}
        </div>
      </div>
      <ConfirmDialog open={!!c} title={c?.title ?? ''} message={c?.msg} confirmLabel={c?.label} danger={c?.danger} loading={busy} onConfirm={() => c?.go()} onClose={() => setAct(null)} />
      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="Reject payment">
        <Textarea label="Reason (emailed to the customer and shown in their account)" hint="Customer-facing. Do not include internal notes." value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
        <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
          <Button variant="danger" loading={busy} disabled={reason.trim().length < 3} onClick={() => void run(`/payments/${a.payment!.id}/reject`, { reason: reason.trim() }, 'Payment rejected.')}>Reject Payment</Button></div>
      </Modal>
    </>
  );
}