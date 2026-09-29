import { Link } from 'react-router-dom';
import { Activity, ArrowRight, Dumbbell, HeartPulse, Move, Smile, Sparkles } from 'lucide-react';

const WHY = [
  { icon: HeartPulse, t: 'Pain Relief', d: 'Care focused on helping you feel more comfortable.' },
  { icon: Activity, t: 'Rehabilitation', d: 'Structured support for your recovery journey.' },
  { icon: Dumbbell, t: 'Strength', d: 'Build strength safely and steadily.' },
  { icon: Move, t: 'Mobility', d: 'Move with more freedom and confidence.' },
  { icon: Smile, t: 'Better Life', d: 'Support for everyday comfort and wellbeing.' },
];

const STATIC_SERVICES = [
  { id: 'dry-cupping', title: 'Dry Cupping', image: '/Dry_Cupping.png' },
  { id: 'needling', title: 'Needling', image: '/Needling.png' },
  { id: 'other-therapy', title: 'Other Therapy', image: '/Other_Therapy.png' },
  { id: 'wet-cupping', title: 'Wet Cupping', image: '/Wet_Cupping.png' },
];

function HeroArt() {
  return (
    <div className="relative flex items-center justify-center">
      {/* Soft decorative glow behind SVG */}
      <div className="absolute -inset-4 rounded-full bg-gradient-to-tr from-gold/15 via-blue-500/5 to-transparent blur-2xl opacity-60" />
      
      <svg 
        viewBox="0 0 320 320" 
        className="relative z-10 mx-auto w-full max-w-xs drop-shadow-xl" 
        role="img" 
        aria-label="Abstract illustration of movement and spine alignment"
      >
        <circle cx="160" cy="160" r="140" fill="none" stroke="#D9A72E" strokeOpacity=".3" strokeWidth="1.5" />
        <circle cx="160" cy="160" r="100" fill="none" stroke="#D9A72E" strokeOpacity=".2" strokeWidth="1.5" />
        <path d="M160 50c-24 18-24 42 0 60s24 42 0 60-24 42 0 60 24 30 0 40" fill="none" stroke="#F4D477" strokeWidth="3" strokeLinecap="round" />
        {[62, 100, 138, 176, 214, 252].map((y, i) => (
          <rect key={y} x={i % 2 ? 150 : 140} y={y - 6} width="30" height="12" rx="6" fill="#D9A72E" opacity={0.95 - i * 0.08} />
        ))}
      </svg>
    </div>
  );
}

export default function Home() {
  return (
    <div className="relative min-h-screen bg-slate-50 text-slate-800 overflow-hidden font-sans selection:bg-gold selection:text-white">
      
      {/* Very subtle background ambient blobs for the light theme */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-gold/5 blur-[100px]" />
      <div className="pointer-events-none absolute top-1/3 -right-40 h-[600px] w-[600px] rounded-full bg-blue-500/5 blur-[120px]" />

      {/* HERO SECTION */}
      <section className="relative z-10 py-16 md:py-24 bg-white shadow-[0_4px_30px_rgba(0,0,0,0.03)] border-b border-slate-100 rounded-b-[3rem]">
        <div className="container-x grid items-center gap-12 md:grid-cols-[1.3fr_1fr]">
          <div className="space-y-6">
            
            {/* Glass Badge - Light Theme */}
            <div className="inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/5 px-4 py-1.5 backdrop-blur-md shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-gold-dark" />
              <span className="text-xs font-bold uppercase tracking-[0.25em] text-gold-dark">
                Physiotherapy &amp; Rehabilitation
              </span>
            </div>

            <h1 className="font-display text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Move Better. <br />
              <span className="bg-gradient-to-r from-navy via-navy-light to-gold bg-clip-text text-transparent">
                Feel Better.
              </span>{' '}
              Live Better.
            </h1>

            <p className="max-w-xl text-base text-slate-600 sm:text-lg leading-relaxed">
              Professional physiotherapy, rehabilitation, and therapeutic care crafted into targeted treatment plans to help you recover faster and move with total confidence.
            </p>

            <div className="flex flex-col gap-4 sm:flex-row pt-2">
              <Link 
                to="/book-appointment" 
                className="group relative inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-gold px-7 font-semibold text-white transition-all duration-300 hover:bg-gold-dark hover:shadow-[0_8px_20px_rgba(217,167,46,0.3)] hover:-translate-y-0.5 active:translate-y-0"
              >
                <span>Book an Appointment</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              
              <Link 
                to="/services" 
                className="inline-flex min-h-[52px] items-center justify-center rounded-xl border border-slate-200 bg-white/50 px-7 font-medium text-slate-700 backdrop-blur-md transition-all duration-300 hover:border-gold/30 hover:bg-slate-50 hover:text-navy hover:-translate-y-0.5 active:translate-y-0 shadow-sm"
              >
                Explore Services
              </Link>
            </div>
          </div>

          <HeroArt />
        </div>
      </section>

      {/* OUR SERVICES SECTION */}
      <section className="relative z-10 container-x py-20" aria-labelledby="svc-h">
        <div className="mb-12 text-center">
          <h2 id="svc-h" className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Our Services
          </h2>
          <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-gradient-to-r from-gold to-gold-light" />
        </div>
        
        {/* Responsive Grid with Light Glass Cards */}
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {STATIC_SERVICES.map((service) => (
            <Link
              key={service.id}
              to="/services"
              className="group relative block overflow-hidden rounded-2xl border border-white bg-white p-2 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-md transition-all duration-500 hover:border-gold/30 hover:shadow-[0_20px_40px_rgba(217,167,46,0.15)] hover:-translate-y-1.5"
            >
              {/* Inner container to hold native 1024x1536 aspect ratio */}
              <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-slate-100">
                <img
                  src={service.image}
                  alt={service.title}
                  className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  loading="lazy"
                />
                
                {/* Subtle shine light effect on hover */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* WHY CHOOSE US SECTION */}
      <section className="relative z-10 py-20 bg-white border-y border-slate-100" aria-labelledby="why-h">
        <div className="container-x">
          <div className="mb-14 text-center">
            <h2 id="why-h" className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Why Choose Us
            </h2>
            <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-gradient-to-r from-gold to-gold-light" />
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
              Move Better • Feel Better • Live Better
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {WHY.map(({ icon: Icon, t, d }) => (
              <div 
                key={t} 
                className="group relative flex flex-col items-center rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all duration-300 hover:border-gold/20 hover:shadow-[0_10px_30px_rgba(217,167,46,0.08)] hover:-translate-y-1"
              >
                {/* Clean icon backdrop */}
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-50 transition-all duration-300 group-hover:scale-110 group-hover:bg-gold/10">
                  <Icon className="h-7 w-7 text-gold transition-colors duration-300 group-hover:text-gold-dark" aria-hidden />
                </div>
                
                <h3 className="mt-5 font-sans text-lg font-bold text-slate-900">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CALL TO ACTION SECTION */}
      <section className="relative z-10 container-x py-20 text-center">
        <div className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white px-6 py-14 shadow-[0_8px_40px_rgba(0,0,0,0.05)] sm:px-12 md:py-20">
          
          {/* Subtle Accent light inside CTA */}
          <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-96 -translate-x-1/2 rounded-full bg-gold/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 right-0 h-48 w-96 rounded-full bg-blue-500/5 blur-3xl" />

          <div className="relative z-10">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Ready to get started?
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-slate-500 sm:text-lg">
              Choose a service and pick a time that suits you best. Booking takes only a few simple steps.
            </p>
            <Link 
              to="/book-appointment" 
              className="mt-8 inline-flex min-h-[52px] items-center justify-center rounded-xl bg-navy px-9 font-semibold text-white transition-all duration-300 hover:bg-navy-light hover:shadow-[0_8px_25px_rgba(23,43,77,0.3)] hover:-translate-y-0.5 active:translate-y-0"
            >
              Book an Appointment
            </Link>
          </div>
        </div>
      </section>
      
    </div>
  );
}