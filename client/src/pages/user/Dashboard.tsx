import { Link } from 'react-router-dom';
import { CalendarPlus } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useAsync } from '../../lib/useAsync';
import { todayIn } from '../../lib/format';
import type { Appointment } from '../../lib/types';
import { AppointmentCard } from '../../components/Cards';
import { EmptyState, ErrorState, PageTitle, Spinner } from '../../components/ui';

export default function Dashboard() {
  const { profile } = useAuth();
  const q = useAsync(() => api<Appointment[]>('/appointments'));
  const today = todayIn('Asia/Kolkata');
  const live = (a: Appointment) => !['cancelled', 'rejected', 'completed'].includes(a.appointment_status);
  const upcoming = (q.data ?? []).filter((a) => a.appointment_date >= today && live(a)).sort((a, b) => (a.appointment_date + a.start_time).localeCompare(b.appointment_date + b.start_time));
  const recent = (q.data ?? []).filter((a) => !upcoming.includes(a)).slice(0, 5);
  return (
    <>
      <PageTitle title={`Hello, ${profile?.full_name?.split(' ')[0] || 'there'}`} subtitle="Manage your appointments below."
        action={<Link to="/book-appointment" className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-gold px-5 text-sm font-semibold text-navy-dark hover:bg-gold-light"><CalendarPlus className="h-4 w-4" />Book an Appointment</Link>} />
      {q.loading ? <Spinner /> : q.error ? <ErrorState message={q.error} onRetry={() => void q.reload()} /> : (
        <div className="space-y-8">
          <section aria-labelledby="up-h"><h2 id="up-h" className="mb-3 text-xl">Upcoming appointment</h2>
            {upcoming[0] ? <AppointmentCard a={upcoming[0]} to={`/appointments/${upcoming[0].id}`} /> :
              <EmptyState title="You don't have any appointments yet." action={<Link to="/book-appointment" className="rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-navy-dark">Book an Appointment</Link>} />}</section>
          {recent.length > 0 && <section aria-labelledby="rec-h"><div className="mb-3 flex items-center justify-between"><h2 id="rec-h" className="text-xl">Recent history</h2><Link to="/appointments" className="text-sm text-navy underline">View all</Link></div>
            <div className="space-y-3">{recent.map((a) => <AppointmentCard key={a.id} a={a} to={`/appointments/${a.id}`} />)}</div></section>}
        </div>
      )}
    </>
  );
}
