import { Link } from 'react-router-dom';
import { ArrowRight, Clock, Stethoscope } from 'lucide-react';
import type { Appointment, Service } from '../lib/types';
import { formatAmount, formatDate, formatPrice, formatTime, optimizeImg } from '../lib/format';
import { StatusBadge } from './ui';

export function ServiceCard({ s }: { s: Service }) {
  return (
    <article className="card flex flex-col gap-3 transition-shadow hover:shadow-md">
      {s.image_url ? <img src={optimizeImg(s.image_url, 600)} alt={s.name} loading="lazy" className="h-40 w-full rounded-lg object-cover" />
        : <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gold/15 text-gold-dark"><Stethoscope className="h-6 w-6" aria-hidden /></div>}
      <h3 className="text-xl">{s.name}</h3>
      <p className="flex-1 text-sm text-gray-600">{s.description}</p>
      <div className="flex items-center justify-between border-t pt-3 text-sm">
        <span className="font-semibold text-navy">{formatPrice(s.pricing_type, s.price)}</span>
        <span className="flex items-center gap-1 text-gray-500"><Clock className="h-3.5 w-3.5" aria-hidden />{s.duration_minutes} min</span>
      </div>
    </article>
  );
}

export function AppointmentCard({ a, to }: { a: Appointment; to: string }) {
  return (
    <article className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 className="font-sans text-base font-semibold text-navy">{a.service?.name ?? 'Appointment'}</h3>
        <p className="text-sm text-gray-600">{formatDate(a.appointment_date)} · {formatTime(a.start_time)}</p>
        <p className="text-sm text-gray-600">{formatAmount(a.amount)} · {a.payment_method === 'online' ? 'Online' : 'Pay at clinic'}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={a.appointment_status} />
        {a.payment_method === 'online' && <span className="flex items-center gap-1 text-xs text-gray-500">Payment: <StatusBadge status={a.payment_status} /></span>}
        <Link to={to} className="ml-auto inline-flex min-h-[44px] items-center gap-1 rounded-lg px-3 text-sm font-medium text-navy hover:bg-navy/5">View Details <ArrowRight className="h-4 w-4" /></Link>
      </div>
    </article>
  );
}
