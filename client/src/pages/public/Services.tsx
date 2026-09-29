import { Link } from 'react-router-dom';
import { ArrowRight, Clock, Sparkles, Info, Calendar, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import type { Service } from '../../lib/types';
import { EmptyState, ErrorState, Spinner } from '../../components/ui';

// Custom Enhanced Service Card
function ModernServiceCard({ service }: { service: Service }) {
  const title = service.name || 'Therapeutic Service';
  const description =
    service.description || 'Professional clinical care tailored to your rehabilitation and health goals.';
  const duration = service.duration_minutes ? `${service.duration_minutes} mins` : '30-45 mins';
  const image = service.image_url || null;

  let price: string;
  if (service.pricing_type === 'contact' || service.price == null) {
    price = 'Contact us';
  } else if (service.pricing_type === 'starting_from') {
    price = `From ₹${service.price}`;
  } else {
    price = `₹${service.price}`;
  }

  return (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)] backdrop-blur-sm transition-all duration-300 hover:border-gold/40 hover:shadow-[0_12px_32px_rgba(217,167,46,0.12)] hover:-translate-y-1">
      <div>
        {/* Optional image header */}
        {image && (
          <div className="mb-5 -mx-6 -mt-6 aspect-[16/9] overflow-hidden bg-slate-100">
            <img
              src={image}
              alt={title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          </div>
        )}

        {/* Badges Bar: Duration & Price */}
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span>{duration}</span>
          </div>

          <div className="inline-flex items-center rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-bold text-gold-dark">
            {price}
          </div>
        </div>

        {/* Service Title */}
        <h3 className="mt-4 font-sans text-xl font-bold tracking-tight text-slate-900 transition-colors duration-200 group-hover:text-gold-dark">
          {title}
        </h3>

        {/* Service Description */}
        <p className="mt-2 text-sm leading-relaxed text-slate-500 line-clamp-3">{description}</p>

        {/* Included Benefits */}
        <ul className="mt-4 space-y-2 border-t border-slate-100 pt-4">
          <li className="flex items-center gap-2 text-xs text-slate-600">
            <CheckCircle2 className="h-3.5 w-3.5 text-gold" />
            <span>Personalized assessment & treatment</span>
          </li>
          <li className="flex items-center gap-2 text-xs text-slate-600">
            <CheckCircle2 className="h-3.5 w-3.5 text-gold" />
            <span>Certified physiotherapy specialist</span>
          </li>
        </ul>
      </div>

      {/* Card Action Footer */}
      <div className="mt-6 pt-2">
        <Link
          to={`/book-appointment?service=${service.id}`}
          className="group/btn inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-semibold text-white transition-all duration-200 hover:bg-gold hover:text-slate-950 hover:shadow-md"
        >
          <span>Book This Treatment</span>
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover/btn:translate-x-1" />
        </Link>
      </div>
    </div>
  );
}

export default function Services() {
  const svc = useAsync(() => api<Service[]>('/services'));

  return (
    <div className="relative min-h-screen bg-slate-50/60 font-sans text-slate-800 selection:bg-gold selection:text-white">
      {/* Background Decorative Ambient Lighting */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-gold/5 blur-[120px]" />
      <div className="pointer-events-none absolute top-1/3 -right-40 h-[500px] w-[500px] rounded-full bg-blue-500/5 blur-[140px]" />

      {/* HEADER SECTION */}
      <section className="relative border-b border-slate-100 bg-white py-12 md:py-16 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
        <div className="container-x">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/5 px-4 py-1.5 backdrop-blur-md shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-gold-dark" />
              <span className="text-xs font-bold uppercase tracking-[0.25em] text-gold-dark">
                Specialized Treatments
              </span>
            </div>

            <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
              Our Clinical Services
            </h1>

            <p className="text-base text-slate-600 sm:text-lg leading-relaxed">
              Explore our range of professional physiotherapy, rehabilitation, and pain-management therapies tailored to your recovery needs.
            </p>

            {/* Pricing Notice Callout */}
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 text-xs text-slate-600 backdrop-blur-sm sm:items-center sm:text-sm">
              <Info className="h-5 w-5 shrink-0 text-gold-dark" />
              <span>
                <strong>Pricing Note:</strong> Prices shown are current. Some specialized treatments start from a base rate; exact pricing is confirmed following your initial consultation.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* SERVICES GRID SECTION */}
      <main className="container-x py-12 md:py-16">
        {svc.loading ? (
          <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-slate-100 bg-white p-12 shadow-sm">
            <Spinner />
          </div>
        ) : svc.error ? (
          <div className="rounded-2xl border border-red-100 bg-white p-8 shadow-sm">
            <ErrorState message={svc.error} onRetry={() => void svc.reload()} />
          </div>
        ) : !svc.data?.length ? (
          <div className="rounded-2xl border border-slate-100 bg-white p-12 shadow-sm">
            <EmptyState title="No services are currently available." />
          </div>
        ) : (
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {svc.data.map((s) => (
              <ModernServiceCard key={s.id} service={s} />
            ))}
          </div>
        )}

        {/* CLINICAL STANDARDS / TRUST BANNER */}
        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_4px_15px_rgba(0,0,0,0.02)]">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold-dark">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Certified Specialists</h4>
              <p className="text-xs text-slate-500">Licensed practitioner care</p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_4px_15px_rgba(0,0,0,0.02)]">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold-dark">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Flexible Scheduling</h4>
              <p className="text-xs text-slate-500">Book convenient time slots</p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_4px_15px_rgba(0,0,0,0.02)]">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold-dark">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Personalized Care</h4>
              <p className="text-xs text-slate-500">Customized treatment plans</p>
            </div>
          </div>
        </div>

        {/* BOTTOM CTA SECTION */}
        <div className="mt-16 rounded-3xl border border-slate-100 bg-white p-8 text-center shadow-[0_8px_30px_rgba(0,0,0,0.04)] md:p-12">
          <div className="mx-auto max-w-xl space-y-3">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Unsure which therapy is right for you?
            </h2>
            <p className="text-sm text-slate-500 sm:text-base">
              Book a general consultation session. Our lead physiotherapist will assess your condition and recommend the best treatment path.
            </p>
            <div className="pt-4">
              <Link
                to="/book-appointment"
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-gold px-8 font-semibold text-white shadow-md transition-all duration-300 hover:bg-gold-dark hover:shadow-[0_8px_25px_rgba(217,167,46,0.3)] hover:-translate-y-0.5"
              >
                <span>Book an Appointment</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}