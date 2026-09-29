import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, CheckCircle2, Clock, Wallet, CreditCard } from 'lucide-react';
import { api, ApiError, errMsg } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { addDays, formatAmount, formatDate, formatPrice, formatTime, todayIn } from '../../lib/format';
import type { Appointment, Availability, PublicSettings, Service } from '../../lib/types';
import { Calendar } from '../../components/Calendar';
import { SlotPicker } from '../../components/SlotPicker';
import { PaymentPanel } from '../../components/PaymentPanel';
import { Button, EmptyState, ErrorState, PageTitle, Spinner, StatusBadge, Textarea } from '../../components/ui';
import { Detail } from './AppointmentDetail';

const STEPS = ['Service', 'Date & Time', 'Details', 'Payment', 'Confirmation'];

export default function Book() {
  const { profile } = useAuth(); const toast = useToast(); const nav = useNavigate();
  const services = useAsync(() => api<Service[]>('/services'));
  const settings = useAsync(() => api<PublicSettings>('/settings'));
  const [step, setStep] = useState(0);
  const [service, setService] = useState<Service | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [start, setStart] = useState<string | null>(null);
  const [method, setMethod] = useState<'offline' | 'online'>('offline');
  const [notes, setNotes] = useState('');
  // Slots are stored together with the selection they were fetched for, so they can never be shown under a different date/service.
  const [avail, setAvail] = useState<{ key: string; data: Availability } | null>(null);
  const [availLoading, setAvailLoading] = useState(false);
  const [availErr, setAvailErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<Appointment | null>(null);

  const slotReq = useRef(0);
  const tz = settings.data?.timezone ?? 'Asia/Kolkata';
  const min = todayIn(tz);
  const max = addDays(min, settings.data?.booking_window_days ?? 60);
  const canOnline = !!service && service.pricing_type !== 'contact';

  const serviceId = service?.id ?? null;
  const slotKey = date && serviceId ? `${date}|${serviceId}` : null;

  // Generation check: every call takes a new id and only the latest id may touch state. The effect cleanup also bumps the
  // id, so a response that arrives after the selection changed (or after unmount) is discarded.
  const loadSlots = useCallback(async () => {
    const id = ++slotReq.current;
    if (!date || !serviceId) { setAvail(null); setAvailErr(null); setAvailLoading(false); return; }
    const key = `${date}|${serviceId}`;
    setAvailLoading(true); setAvailErr(null);
    try {
      const r = await api<Availability>(`/appointments/available-slots?date=${date}&service_id=${serviceId}`);
      if (id === slotReq.current) setAvail({ key, data: r });
    } catch (e) {
      if (id === slotReq.current) { setAvail(null); setAvailErr(errMsg(e)); }
    } finally { if (id === slotReq.current) setAvailLoading(false); }
  }, [date, serviceId]);
  useEffect(() => {
    setStart(null);
    void loadSlots();
    return () => { slotReq.current++; };
  }, [loadSlots]);

  async function submit() {
    if (!service || !date || !start) return;
    setSubmitting(true);
    try {
      const appt = await api<Appointment>('/appointments', { method: 'POST', body: { service_id: service.id, date, start_time: start, payment_method: method, ...(notes.trim() ? { notes: notes.trim() } : {}) } });
      setCreated(appt); setStep(4); toast.success('Appointment request submitted.');
    } catch (e) {
      toast.error(errMsg(e));
      if (e instanceof ApiError && ['SLOT_TAKEN', 'SLOT_BLOCKED', 'INVALID_SLOT', 'PAST_TIME'].includes(e.code ?? '')) { setStart(null); setStep(1); void loadSlots(); }
    } finally { setSubmitting(false); }
  }
  const reloadCreated = async () => { if (created) setCreated(await api<Appointment>(`/appointments/${created.id}`)); };
  const summary = useMemo(() => service && date && start ? { service, date, start } : null, [service, date, start]);

  return (
    <>
      <PageTitle title="Book Your Appointment" />
      <ol className="mb-6 flex items-center gap-1 overflow-x-auto pb-2 text-xs sm:text-sm" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? 'step' : undefined} className="flex shrink-0 items-center gap-1.5">
            <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${i < step ? 'bg-navy text-white' : i === step ? 'bg-gold text-navy-dark' : 'bg-gray-200 text-gray-600'}`}>{i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}</span>
            <span className={i === step ? 'font-semibold text-navy' : 'text-gray-500'}>{s}</span>{i < STEPS.length - 1 && <span className="mx-1 h-px w-4 bg-gray-300 sm:w-8" />}
          </li>
        ))}
      </ol>

      {step === 0 && (services.loading ? <Spinner /> : services.error ? <ErrorState message={services.error} onRetry={() => void services.reload()} /> : !services.data?.length ? <EmptyState title="No services are available right now." /> : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {services.data.map((s) => (
              <button key={s.id} type="button" onClick={() => { setService(s); if (s.pricing_type === 'contact') setMethod('offline'); }} aria-pressed={service?.id === s.id}
                className={`card text-left transition-colors ${service?.id === s.id ? 'border-gold ring-2 ring-gold/50' : 'hover:border-gold/60'}`}>
                <span className="block font-display text-lg text-navy">{s.name}</span>
                <span className="mt-1 block text-sm font-semibold">{formatPrice(s.pricing_type, s.price)}</span>
                <span className="mt-1 flex items-center gap-1 text-xs text-gray-500"><Clock className="h-3 w-3" />{s.duration_minutes} min</span>
              </button>
            ))}
          </div>
          {service?.pricing_type === 'contact' && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Pricing for this service is confirmed by the clinic. You can book now and pay at the clinic.</p>}
          <Button variant="gold" disabled={!service} onClick={() => setStep(1)} className="w-full sm:w-auto">Continue</Button>
        </div>
      ))}

      {step === 1 && service && (
        <div className="space-y-5">
          <div className="grid gap-6 md:grid-cols-[minmax(0,340px)_1fr]">
            <div><h2 className="mb-2 text-lg">Choose a date</h2><Calendar value={date} min={min} max={max} onChange={setDate} /></div>
            <div><h2 className="mb-2 text-lg">Choose a time</h2>
              {!date ? <p className="text-sm text-gray-500">Select a date to see available times.</p> : availLoading || (!availErr && avail?.key !== slotKey) ? <Spinner label="Checking availability…" /> : availErr ? <ErrorState message={availErr} onRetry={() => void loadSlots()} /> : avail && <SlotPicker availability={avail.data} value={start} onChange={setStart} />}
            </div>
          </div>
          <div className="flex gap-3"><Button variant="outline" onClick={() => setStep(0)}>Back</Button><Button variant="gold" disabled={!date || !start} onClick={() => setStep(2)} className="flex-1 sm:flex-none">Continue</Button></div>
        </div>
      )}

      {step === 2 && summary && (
        <div className="max-w-xl space-y-4">
          <section className="card"><h2 className="mb-2 text-lg">Review your appointment</h2><dl>
            <Detail k="Name" v={profile?.full_name} /><Detail k="Phone" v={profile?.phone || '—'} /><Detail k="Email" v={profile?.email} />
            <Detail k="Service" v={summary.service.name} /><Detail k="Date" v={formatDate(summary.date)} /><Detail k="Time" v={formatTime(summary.start)} />
            <Detail k="Duration" v={`${summary.service.duration_minutes} min`} /><Detail k="Price" v={formatPrice(summary.service.pricing_type, summary.service.price)} /></dl></section>
          <Textarea label="Notes for the clinic (optional)" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} hint="Please don't include detailed medical information." />
          <div className="flex gap-3"><Button variant="outline" onClick={() => setStep(1)}>Back</Button><Button variant="gold" onClick={() => setStep(3)} className="flex-1 sm:flex-none">Continue to payment</Button></div>
        </div>
      )}

      {step === 3 && summary && (
        <div className="max-w-xl space-y-4">
          <h2 className="text-lg">How would you like to pay?</h2>
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Payment method">
            {([['offline', 'Pay at Clinic', 'Pay when you visit. Admin will confirm your request.', Wallet, true], ['online', 'Online Payment', 'Pay by UPI and upload a screenshot.', CreditCard, canOnline]] as const).map(([v, t, d, I, enabled]) => (
              <button key={v} type="button" role="radio" aria-checked={method === v} disabled={!enabled} onClick={() => setMethod(v)}
                className={`card text-left disabled:cursor-not-allowed disabled:opacity-50 ${method === v ? 'border-gold ring-2 ring-gold/50' : ''}`}>
                <I className="h-5 w-5 text-gold" aria-hidden /><span className="mt-2 block font-semibold text-navy">{t}</span><span className="text-xs text-gray-600">{d}{!enabled && ' Not available for this service.'}</span>
              </button>
            ))}
          </div>
          <section className="card text-sm"><dl><Detail k="Service" v={summary.service.name} /><Detail k="When" v={`${formatDate(summary.date)}, ${formatTime(summary.start)}`} />
            <Detail k="Amount" v={formatAmount(summary.service.pricing_type === 'contact' ? null : summary.service.price)} /><Detail k="Payment" v={method === 'online' ? 'Online Payment' : 'Pay at Clinic'} /></dl>
            {summary.service.pricing_type === 'starting_from' && <p className="mt-2 text-xs text-gray-500">This is the starting price; the final amount is confirmed at your visit. The amount charged is set by the clinic, not this page.</p>}</section>
          <div className="flex gap-3"><Button variant="outline" onClick={() => setStep(2)} disabled={submitting}>Back</Button>
            <Button variant="gold" loading={submitting} onClick={submit} className="flex-1 sm:flex-none">{submitting ? 'Booking appointment…' : 'Confirm Appointment Request'}</Button></div>
        </div>
      )}

      {step === 4 && created && (
        <div className="max-w-2xl space-y-5">
          <div className="card border-gold/50 bg-gold/10 text-center"><CheckCircle2 className="mx-auto h-10 w-10 text-emerald-700" aria-hidden /><h2 className="mt-2 text-2xl">Appointment Request Submitted</h2>
            <p className="mt-1 text-sm text-gray-600">Appointment ID: <strong>{created.id.slice(0, 8).toUpperCase()}</strong></p></div>
          <section className="card"><dl><Detail k="Service" v={created.service?.name} /><Detail k="Date" v={formatDate(created.appointment_date)} /><Detail k="Time" v={formatTime(created.start_time)} />
            <Detail k="Amount" v={formatAmount(created.amount)} /><Detail k="Payment method" v={created.payment_method === 'online' ? 'Online Payment' : 'Pay at Clinic'} /><Detail k="Status" v={<StatusBadge status={created.appointment_status} />} /></dl></section>
          {created.payment_method === 'online' ? <><p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Please complete payment and upload your payment screenshot.</p><PaymentPanel appt={created} onDone={() => void reloadCreated()} /></> :
            <p className="text-sm text-gray-600">The clinic will review your request and confirm by email.</p>}
          <p className="text-xs text-gray-500">Please check your spam or junk folder too for your appointment confirmation email.</p>
          <div className="flex flex-col gap-3 sm:flex-row"><Button variant="gold" onClick={() => nav(`/appointments/${created.id}`)}>View My Appointment</Button><Link to="/dashboard" className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-navy/30 px-5 text-sm font-medium text-navy hover:bg-navy/5">Go to Dashboard</Link></div>
        </div>
      )}
    </>
  );
}