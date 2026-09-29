import { Link } from 'react-router-dom';
import { Clock, Mail, MapPin, Phone, Sparkles, ArrowRight, CalendarDays } from 'lucide-react';
import { api } from '../../lib/api';
import { formatTime } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import type { PublicSettings } from '../../lib/types';
import { ErrorState, Spinner } from '../../components/ui';

// Custom designed block for contact information
const ContactBlock = ({ 
  icon: Icon, 
  label, 
  value, 
  href 
}: { 
  icon: any; 
  label: string; 
  value?: string; 
  href?: string 
}) => {
  const isClickable = Boolean(href && value);
  const Wrapper = isClickable ? 'a' : 'div';
  
  return (
    <Wrapper 
      href={isClickable ? href : undefined} 
      className={`group flex items-start gap-4 rounded-2xl border border-transparent p-4 transition-all duration-300 ${
        isClickable ? 'hover:border-gold/20 hover:bg-slate-50 hover:shadow-sm' : ''
      }`}
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold-dark transition-colors duration-300 group-hover:bg-gold/20">
        <Icon className="h-6 w-6" aria-hidden />
      </div>
      <div className="pt-1">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className={`mt-1 font-semibold ${isClickable ? 'text-slate-900 transition-colors group-hover:text-gold-dark' : 'text-slate-900'}`}>
          {value || 'Will be updated soon'}
        </p>
      </div>
    </Wrapper>
  );
};

export default function Contact() {
  const q = useAsync(() => api<PublicSettings>('/settings'));
  const s = q.data;

  return (
    <div className="relative min-h-screen bg-slate-50/60 font-sans text-slate-800 selection:bg-gold selection:text-white pb-20">
      
      {/* Background Decorative Ambient Lighting */}
      <div className="pointer-events-none absolute top-0 left-1/4 h-[500px] w-[500px] rounded-full bg-gold/5 blur-[120px]" />
      <div className="pointer-events-none absolute top-1/3 -right-20 h-[400px] w-[400px] rounded-full bg-blue-500/5 blur-[140px]" />

      <main className="container-x relative z-10 mx-auto max-w-5xl py-12 md:py-20">
        
        {/* Page Header */}
        <div className="mb-12 text-center md:mb-16">
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-gold/20 bg-white px-4 py-1.5 shadow-sm">
            <Sparkles className="h-4 w-4 text-gold-dark" />
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-gold-dark">
              Get in Touch
            </span>
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Contact Us
          </h1>
          <div className="mx-auto mt-6 h-1 w-20 rounded-full bg-gradient-to-r from-gold to-gold-light" />
        </div>

        {/* Loading / Error States */}
        {q.loading ? (
          <div className="flex min-h-[300px] items-center justify-center rounded-3xl border border-slate-100 bg-white p-12 shadow-sm">
            <Spinner />
          </div>
        ) : q.error || !s ? (
          <div className="rounded-3xl border border-red-100 bg-white p-8 shadow-sm">
            <ErrorState message={q.error ?? 'Unable to load contact information'} onRetry={() => void q.reload()} />
          </div>
        ) : (
          
          <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
            
            {/* Left Column: Contact Info Card */}
            <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white p-8 shadow-[0_8px_40px_rgba(0,0,0,0.03)] sm:p-10">
              <h2 className="mb-8 text-2xl font-bold text-slate-900">
                {s.clinic_name}
              </h2>
              
              <div className="flex flex-col gap-2">
                <ContactBlock 
                  icon={Phone} 
                  label="Phone Number" 
                  value={s.phone} 
                  href={s.phone ? `tel:${s.phone}` : undefined} 
                />
                
                <div className="mx-16 my-1 border-t border-slate-50" />
                
                <ContactBlock 
                  icon={Mail} 
                  label="Email Address" 
                  value={s.email} 
                  href={s.email ? `mailto:${s.email}` : undefined} 
                />
                
                <div className="mx-16 my-1 border-t border-slate-50" />
                
                <ContactBlock 
                  icon={MapPin} 
                  label="Clinic Location" 
                  value={s.address} 
                  href={s.address ? `https://maps.google.com/?q=${encodeURIComponent(s.address)}` : undefined}
                />
              </div>
            </div>

            {/* Right Column: Business Hours & CTA */}
            <div className="flex flex-col gap-6">
              
              {/* Elevated Business Hours Card */}
              <div className="rounded-3xl border border-slate-200/60 bg-slate-100/50 p-8 backdrop-blur-sm sm:p-10">
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm">
                    <Clock className="h-5 w-5 text-gold-dark" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Opening Hours</h3>
                </div>
                
                <div className="space-y-4 rounded-2xl bg-white p-5 shadow-[0_4px_15px_rgba(0,0,0,0.02)]">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <span className="font-medium text-slate-500">Morning Session</span>
                    <span className="font-bold text-slate-900">
                      {s.morning_start ? formatTime(s.morning_start) : '--'} - {s.morning_end ? formatTime(s.morning_end) : '--'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="font-medium text-slate-500">Evening Session</span>
                    <span className="font-bold text-slate-900">
                      {s.evening_start ? formatTime(s.evening_start) : '--'} - {s.evening_end ? formatTime(s.evening_end) : '--'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Booking Action Card */}
              <div className="rounded-3xl border border-slate-100 bg-white p-8 text-center shadow-[0_8px_30px_rgba(0,0,0,0.03)] sm:p-10">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-50">
                  <CalendarDays className="h-6 w-6 text-slate-400" />
                </div>
                <h3 className="mb-2 text-xl font-bold text-slate-900">Ready to visit us?</h3>
                <p className="mb-6 text-sm text-slate-500">
                  Secure your slot online. It takes less than a minute.
                </p>
                <Link 
                  to="/book-appointment" 
                  className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-navy px-6 py-4 font-semibold text-white transition-all duration-300 hover:bg-navy-light hover:shadow-[0_8px_25px_rgba(23,43,77,0.2)] hover:-translate-y-0.5"
                >
                  <span>Book an Appointment</span>
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </div>

            </div>
          </div>
        )}
      </main>
    </div>
  );
}