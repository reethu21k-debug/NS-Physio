import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { todayIn } from '../../lib/format';
import type { Appointment } from '../../lib/types';
import { AppointmentCard } from '../../components/Cards';
import { EmptyState, ErrorState, PageTitle, Spinner } from '../../components/ui';

const FILTERS = ['All', 'Upcoming', 'Completed', 'Cancelled'] as const;
export default function MyAppointments() {
  const q = useAsync(() => api<Appointment[]>('/appointments'));
  const [f, setF] = useState<(typeof FILTERS)[number]>('All');
  const today = todayIn('Asia/Kolkata');
  const list = (q.data ?? []).filter((a) =>
    f === 'All' ? true : f === 'Completed' ? a.appointment_status === 'completed' : f === 'Cancelled' ? ['cancelled', 'rejected'].includes(a.appointment_status)
      : a.appointment_date >= today && !['cancelled', 'rejected', 'completed'].includes(a.appointment_status));
  return (
    <>
      <PageTitle title="My Appointments" />
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Filter appointments">
        {FILTERS.map((x) => <button key={x} role="tab" aria-selected={f === x} onClick={() => setF(x)} className={`min-h-[40px] rounded-full border px-4 text-sm ${f === x ? 'border-gold bg-gold font-semibold text-navy-dark' : 'border-gray-300 bg-white'}`}>{x}</button>)}
      </div>
      {q.loading ? <Spinner /> : q.error ? <ErrorState message={q.error} onRetry={() => void q.reload()} /> : !list.length ?
        <EmptyState title="You don't have any appointments yet." action={<Link to="/book-appointment" className="rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-navy-dark">Book an Appointment</Link>} /> :
        <div className="space-y-3">{list.map((a) => <AppointmentCard key={a.id} a={a} to={`/appointments/${a.id}`} />)}</div>}
    </>
  );
}
