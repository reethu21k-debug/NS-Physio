import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  CalendarCheck,
  Clock,
  CreditCard,
  Dumbbell,
  HeartPulse,
  Move,
  Smile,
} from 'lucide-react';
import ScrollStack, { ScrollStackItem } from '../../components/ScrollStack';

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

/* Gradient hairline border for the Why Choose Us cards (mask keeps only the 1px ring) */
const CARD_BORDER_STYLE: CSSProperties = {
  padding: '1px',
  background:
    'linear-gradient(135deg, rgba(244,212,119,0.95) 0%, rgba(255,255,255,0.9) 38%, rgba(217,167,46,0.35) 70%, rgba(244,212,119,0.75) 100%)',
  WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
  WebkitMaskComposite: 'xor',
  mask: 'linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0)',
};

/* Outlined number watermark */
const NUMBER_OUTLINE_STYLE: CSSProperties = {
  WebkitTextStroke: '1.5px rgba(217,167,46,0.28)',
  color: 'transparent',
};

/* Hero: faint dot grid that fades out away from the arch */
const HERO_DOTS_STYLE: CSSProperties = {
  backgroundImage: 'radial-gradient(rgba(23,43,77,0.10) 1px, transparent 1px)',
  backgroundSize: '24px 24px',
  WebkitMaskImage: 'radial-gradient(ellipse 70% 80% at 75% 45%, #000 0%, transparent 70%)',
  maskImage: 'radial-gradient(ellipse 70% 80% at 75% 45%, #000 0%, transparent 70%)',
};

/* Hero: arch backdrop (cream → warm gold) */
const ARCH_BG_STYLE: CSSProperties = {
  background: 'linear-gradient(180deg, #FFFDF6 0%, #FBEFC9 55%, #F1D38A 100%)',
};

/* Hero: soft highlight behind the spine */
const ARCH_GLOW_STYLE: CSSProperties = {
  background: 'radial-gradient(60% 50% at 50% 38%, rgba(255,255,255,0.85), rgba(255,255,255,0) 70%)',
};

/* ------------------------------------------------------------------ */
/*  BUTTONS                                                            */
/* ------------------------------------------------------------------ */

type BtnProps = { to: string; children: ReactNode; className?: string };

/* Light sweep that glides across a button on hover */
function Sweep({ tone = 'light' }: { tone?: 'light' | 'gold' }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent ${
        tone === 'gold' ? 'via-gold-light/40' : 'via-white/60'
      } to-transparent transition-transform duration-[900ms] ease-out group-hover:translate-x-[320%] motion-reduce:hidden`}
    />
  );
}

/* PRIMARY — polished gold, glossy top edge, arrow that straightens on hover */
function GoldButton({ to, children, className = '' }: BtnProps) {
  return (
    <Link
      to={to}
      className={`group relative inline-flex rounded-full bg-gradient-to-b from-gold-light via-gold to-gold-dark p-[1.5px] shadow-[0_10px_28px_-8px_rgba(217,167,46,0.6)] transition-all duration-500 hover:-translate-y-0.5 hover:shadow-[0_18px_38px_-10px_rgba(217,167,46,0.75)] active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 motion-reduce:transition-none ${className}`}
    >
      <span className="relative flex min-h-[52px] w-full items-center justify-center gap-4 overflow-hidden rounded-full bg-gradient-to-b from-gold-light via-gold to-[#C99A25] pl-7 pr-1.5">
        {/* glossy top half */}
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/45 to-transparent" />
        <Sweep />
        <span className="relative text-[15px] font-semibold tracking-wide text-navy">{children}</span>
        <span className="relative grid h-10 w-10 place-items-center rounded-full bg-navy text-gold-light shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_4px_10px_-2px_rgba(7,20,38,0.5)] transition-transform duration-500 group-hover:translate-x-0.5">
          <ArrowRight className="h-4 w-4 -rotate-45 transition-transform duration-500 group-hover:rotate-0" />
        </span>
      </span>
    </Link>
  );
}

/* SECONDARY — frosted glass, gradient hairline, dot that stretches into a line */
function GlassButton({ to, children, className = '' }: BtnProps) {
  return (
    <Link
      to={to}
      className={`group relative inline-flex rounded-full bg-gradient-to-br from-slate-200 via-white to-gold/40 p-px shadow-[0_8px_24px_-12px_rgba(15,23,42,0.35)] transition-all duration-500 hover:-translate-y-0.5 hover:from-gold/70 hover:via-gold-light/40 hover:to-gold/70 hover:shadow-[0_16px_34px_-14px_rgba(217,167,46,0.55)] active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 motion-reduce:transition-none ${className}`}
    >
      <span className="relative flex min-h-[52px] w-full items-center justify-center gap-3 overflow-hidden rounded-full bg-white/70 px-8 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
        {/* warm wash that fades in on hover */}
        <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-r from-gold/15 via-gold/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        <span aria-hidden className="relative h-1.5 w-1.5 rounded-full bg-gold transition-all duration-500 group-hover:w-6" />
        <span className="relative text-[15px] font-medium tracking-wide text-slate-700 transition-colors duration-300 group-hover:text-navy">
          {children}
        </span>
      </span>
    </Link>
  );
}

/* CTA — dark navy glass, gold hairline edge, gold arrow chip */
function NavyGlassButton({ to, children, className = '' }: BtnProps) {
  return (
    <Link
      to={to}
      className={`group relative inline-flex rounded-full bg-gradient-to-b from-gold-light/80 via-gold/25 to-gold/70 p-[1.5px] shadow-[0_14px_34px_-10px_rgba(7,20,38,0.6)] transition-all duration-500 hover:-translate-y-0.5 hover:shadow-[0_20px_44px_-12px_rgba(7,20,38,0.75)] active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 motion-reduce:transition-none ${className}`}
    >
      <span className="relative flex min-h-[56px] w-full items-center justify-center gap-4 overflow-hidden rounded-full bg-gradient-to-b from-navy-light to-navy pl-8 pr-1.5">
        {/* glassy top sheen */}
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/15 to-transparent" />
        <Sweep tone="gold" />
        <span className="relative text-[15px] font-semibold tracking-wide text-white">{children}</span>
        <span className="relative grid h-11 w-11 place-items-center rounded-full bg-gradient-to-b from-gold-light to-gold text-navy shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_4px_12px_-2px_rgba(217,167,46,0.6)] transition-transform duration-500 group-hover:translate-x-0.5">
          <ArrowRight className="h-4 w-4 -rotate-45 transition-transform duration-500 group-hover:rotate-0" />
        </span>
      </span>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  PAGE                                                               */
/* ------------------------------------------------------------------ */

export default function Home() {
  return (
    <div className="relative min-h-screen bg-slate-50 text-slate-800 overflow-hidden font-sans selection:bg-gold selection:text-white">
      {/* Gentle drifting motion for the hero cards: large screens only, and off for reduced-motion users */}
      <style>{`
        @keyframes ns-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @media (min-width: 1024px) and (prefers-reduced-motion: no-preference) {
          .ns-float { animation: ns-float 6s ease-in-out infinite; }
        }
      `}</style>

      {/* Very subtle background ambient blobs for the light theme */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-gold/5 blur-[100px]" />
      <div className="pointer-events-none absolute top-1/3 -right-40 h-[600px] w-[600px] rounded-full bg-blue-500/5 blur-[120px]" />

      {/* HERO SECTION */}
      <section className="relative z-10 overflow-hidden py-12 sm:py-16 md:py-20 bg-white shadow-[0_4px_30px_rgba(0,0,0,0.03)] border-b border-slate-100 rounded-b-[2rem] md:rounded-b-[3rem]">
        {/* faint dot grid behind the arch */}
        <div aria-hidden className="pointer-events-none absolute inset-0" style={HERO_DOTS_STYLE} />

        <div className="container-x relative grid items-center gap-14 md:gap-10 md:grid-cols-[1.25fr_1fr]">
          {/* LEFT: text */}
          <div className="space-y-6 text-center md:text-left">
            {/* Eyebrow: hairline + small caps */}
            <div className="flex items-center justify-center gap-3 md:justify-start">
              <span aria-hidden className="h-px w-10 bg-gradient-to-r from-gold to-gold/30" />
              <span className="text-xs font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em] text-gold-dark">
                Physiotherapy &amp; Rehabilitation
              </span>
            </div>

            {/* Caption image: Restore_Recover_Rebuild.png (2172 x 237) */}
            <h1 className="m-0">
              <img
                src="/Restore_Recover_Rebuild.png"
                alt="Restore. Recover. Rebuild."
                width={2172}
                height={237}
                className="mx-auto block h-auto w-full max-w-[320px] sm:max-w-[440px] lg:max-w-[540px] md:mx-0"
              />
            </h1>

            <p className="mx-auto max-w-xl text-base text-slate-600 sm:text-lg leading-relaxed md:mx-0">
              Professional physiotherapy, rehabilitation, and therapeutic care crafted into targeted treatment plans to help you recover faster and move with total confidence.
            </p>

            <div className="flex flex-col items-stretch gap-4 pt-2 sm:flex-row sm:items-center sm:justify-center md:justify-start">
              <GoldButton to="/book-appointment" className="w-full sm:w-auto">
                Book an Appointment
              </GoldButton>
              <GlassButton to="/services" className="w-full sm:w-auto">
                Explore Services
              </GlassButton>
            </div>

            {/* Quick facts */}
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5 border-t border-slate-200/70 pt-5 text-xs font-medium text-slate-500 md:justify-start">
              <span className="inline-flex items-center gap-2">
                <Clock aria-hidden className="h-3.5 w-3.5 text-gold-dark" />
                30-min sessions
              </span>
              <span className="inline-flex items-center gap-2">
                <CalendarCheck aria-hidden className="h-3.5 w-3.5 text-gold-dark" />
                Morning &amp; evening slots
              </span>
              <span className="inline-flex items-center gap-2">
                <CreditCard aria-hidden className="h-3.5 w-3.5 text-gold-dark" />
                Pay at clinic or UPI
              </span>
            </div>
          </div>

          {/* RIGHT: Hero_Image.png (1024 x 1536, 2:3 portrait) inside an arch frame */}
          <div className="relative flex justify-center pb-6 pt-8 md:pb-4 md:pt-10">
            <div className="relative w-[min(250px,70vw)] sm:w-[310px] md:w-[280px] lg:w-[350px]">
              {/* offset arch outlines (tighter on small screens so nothing clips) */}
              <div
                aria-hidden
                className="absolute -inset-x-2.5 -top-2.5 bottom-0 rounded-t-full border border-b-0 border-gold/30 sm:-inset-x-4 sm:-top-4"
              />
              <div
                aria-hidden
                className="absolute -inset-x-5 -top-5 bottom-0 rounded-t-full border border-b-0 border-gold/15 sm:-inset-x-8 sm:-top-8"
              />

              {/* the arch: gold hairline edge around a cream-to-gold backdrop */}
              <div className="relative aspect-[4/5] rounded-t-full bg-gradient-to-b from-gold to-gold-light p-[1.5px] shadow-[0_44px_80px_-36px_rgba(217,167,46,0.7)]">
                <div className="relative isolate h-full w-full overflow-hidden rounded-t-full" style={ARCH_BG_STYLE}>
                  {/* inner hairline arch */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-3 rounded-t-full border border-b-0 border-white/70"
                  />
                  {/* soft highlight behind the figure */}
                  <div aria-hidden className="pointer-events-none absolute inset-0" style={ARCH_GLOW_STYLE} />

                  {/* multiply blend drops the white photo background; bottom edge sits on the arch base */}
                  <img
                    src="/Hero_Image.png"
                    alt="Physiotherapy and rehabilitation at NS Physio Clinic"
                    width={1024}
                    height={1536}
                    className="absolute bottom-0 left-1/2 h-[98%] w-auto max-w-none -translate-x-1/2 select-none mix-blend-multiply"
                  />
                </div>
              </div>

              {/* floor line under the arch */}
              <div
                aria-hidden
                className="absolute -inset-x-5 -bottom-px h-px bg-gradient-to-r from-transparent via-gold to-transparent sm:-inset-x-10"
              />

              {/* vertical label (large screens) */}
              <span
                aria-hidden
                className="pointer-events-none absolute -right-12 top-1/2 hidden -translate-y-1/2 select-none text-[10px] font-semibold uppercase tracking-[0.5em] text-gold-dark/60 lg:block"
                style={{ writingMode: 'vertical-rl' }}
              >
                NS Physio Clinic
              </span>

              {/*
                Glass cards.
                < lg : stacked under the arch, staggered left / right, never touching the photo.
                >= lg: wrapper disappears (lg:contents) and the cards float over the arch edges.
              */}
              <div className="mt-7 flex flex-col gap-3 lg:contents">
                {/* booking link */}
                <Link
                  to="/book-appointment"
                  className="ns-float group flex w-max max-w-full items-center gap-3 self-end rounded-2xl border border-white/70 bg-white/80 py-2.5 pl-2.5 pr-4 shadow-[0_18px_36px_-16px_rgba(15,23,42,0.35)] backdrop-blur-xl transition-colors duration-300 hover:border-gold/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold lg:absolute lg:-right-12 lg:top-[14%] lg:self-auto"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-b from-gold-light to-gold text-navy shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
                    <CalendarCheck aria-hidden className="h-[18px] w-[18px]" />
                  </span>
                  <span className="text-left leading-tight">
                    <span className="block text-sm font-semibold text-slate-800">Book online</span>
                    <span className="block text-[11px] text-slate-500">in a few simple steps</span>
                  </span>
                  <ArrowRight
                    aria-hidden
                    className="h-4 w-4 shrink-0 -rotate-45 text-gold-dark transition-transform duration-500 group-hover:rotate-0"
                  />
                </Link>

                {/* care promise */}
                <div
                  className="ns-float flex w-max max-w-full items-center gap-3 self-start rounded-2xl border border-white/70 bg-white/80 py-2.5 pl-2.5 pr-4 shadow-[0_18px_36px_-16px_rgba(15,23,42,0.35)] backdrop-blur-xl lg:absolute lg:-left-14 lg:bottom-[16%] lg:self-auto"
                  style={{ animationDelay: '-3s' }}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy text-gold-light shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
                    <HeartPulse aria-hidden className="h-[18px] w-[18px]" />
                  </span>
                  <span className="leading-tight">
                    <span className="block text-sm font-semibold text-slate-800">Targeted care</span>
                    <span className="block text-[11px] text-slate-500">Plans built around you</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* OUR SERVICES SECTION */}
      <section className="relative z-10 container-x py-14 sm:py-16" aria-labelledby="svc-h">
        {/* Heading image: Our_Services.png (1910 x 280) */}
        <h2 id="svc-h" className="m-0 mb-8 sm:mb-10">
          <img
            src="/Our_Services.png"
            alt="Our Services"
            width={1910}
            height={280}
            loading="lazy"
            decoding="async"
            className="mx-auto block h-auto w-full max-w-[300px] sm:max-w-[400px] lg:max-w-[480px]"
          />
        </h2>

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

      {/* WHY CHOOSE US SECTION — Premium White Glass Stack */}
      <section className="relative z-10 bg-white pt-14 sm:pt-16 border-y border-slate-100" aria-labelledby="why-h">
        {/* Colored blobs behind the glass so the frosted effect has something to blur */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="absolute -left-32 top-[12%] h-[420px] w-[420px] rounded-full bg-gold/25 blur-[90px]" />
          <div className="absolute -right-40 top-[38%] h-[480px] w-[480px] rounded-full bg-blue-500/20 blur-[100px]" />
          <div className="absolute -left-24 top-[66%] h-[400px] w-[400px] rounded-full bg-gold/25 blur-[90px]" />
          <div className="absolute -right-24 bottom-[4%] h-[360px] w-[360px] rounded-full bg-blue-500/20 blur-[100px]" />
        </div>

        <div className="container-x relative">
          {/* Heading image: Why_Choose_Us.png (2172 x 345) */}
          <h2 id="why-h" className="m-0 mb-8 sm:mb-10">
            <img
              src="/Why_Choose_Us.png"
              alt="Why Choose Us"
              width={2172}
              height={345}
              loading="lazy"
              decoding="async"
              className="mx-auto block h-auto w-full max-w-[300px] sm:max-w-[420px] lg:max-w-[500px]"
            />
          </h2>

          <div className="mx-auto max-w-3xl">
            <ScrollStack
              useWindowScroll
              itemDistance={40}
              itemScale={0.03}
              itemStackDistance={28}
              stackPosition="22%"
              scaleEndPosition="12%"
              baseScale={0.86}
            >
              {WHY.map(({ icon: Icon, t, d }, i) => {
                const num = String(i + 1).padStart(2, '0');
                const total = String(WHY.length).padStart(2, '0');

                return (
                  <ScrollStackItem
                    key={t}
                    itemClassName="relative h-48 w-full overflow-hidden rounded-[2rem] bg-white/75 shadow-[0_28px_56px_-16px_rgba(15,23,42,0.18),0_6px_16px_-6px_rgba(15,23,42,0.08),inset_0_1px_1px_rgba(255,255,255,1)] backdrop-blur-[30px] backdrop-saturate-150 transform-gpu sm:h-56"
                  >
                    {/* Gradient hairline border */}
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-0 rounded-[2rem]"
                      style={CARD_BORDER_STYLE}
                    />

                    {/* Glass sheen */}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/90 via-white/25 to-transparent" />

                    {/* Warm corner glow */}
                    <div className="pointer-events-none absolute -left-12 -top-12 h-44 w-44 rounded-full bg-gold/25 blur-3xl" />

                    {/* Outlined number watermark */}
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -right-1 top-1/2 -translate-y-1/2 select-none font-display text-[6rem] font-bold leading-none tracking-tighter sm:right-6 sm:text-[9rem]"
                      style={NUMBER_OUTLINE_STYLE}
                    >
                      {num}
                    </span>

                    {/* Fine gold line along the bottom edge */}
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-x-8 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent"
                    />

                    <div className="relative flex h-full items-center gap-5 px-6 sm:gap-8 sm:px-10">
                      {/* Icon medallion */}
                      <div className="relative shrink-0">
                        <div
                          aria-hidden
                          className="absolute -inset-1.5 rounded-full bg-[conic-gradient(from_140deg,rgba(244,212,119,0.95),rgba(217,167,46,0.15),rgba(244,212,119,0.85),rgba(217,167,46,0.25),rgba(244,212,119,0.95))]"
                        />
                        <div className="relative grid h-16 w-16 place-items-center rounded-full bg-gradient-to-b from-white to-slate-50 shadow-[inset_0_2px_4px_rgba(255,255,255,1),0_10px_22px_-8px_rgba(15,23,42,0.25)] sm:h-20 sm:w-20">
                          <Icon className="h-7 w-7 text-gold-dark sm:h-9 sm:w-9" strokeWidth={1.5} aria-hidden />
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-gold-dark">
                          {num}
                          <span className="mx-1.5 text-slate-300">/</span>
                          <span className="text-slate-400">{total}</span>
                        </p>
                        <h3 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-slate-800 sm:text-3xl">
                          {t}
                        </h3>
                        <div aria-hidden className="mt-2.5 h-[2px] w-10 rounded-full bg-gradient-to-r from-gold to-gold-light" />
                        <p className="mt-2.5 max-w-[15rem] text-sm leading-relaxed text-slate-500 sm:max-w-sm sm:text-base">
                          {d}
                        </p>
                      </div>
                    </div>
                  </ScrollStackItem>
                );
              })}
            </ScrollStack>
          </div>
        </div>
      </section>

      {/* CALL TO ACTION SECTION */}
      <section className="relative z-10 container-x py-14 sm:py-16 text-center">
        <div className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white px-5 py-12 shadow-[0_8px_40px_rgba(0,0,0,0.05)] sm:px-12 md:py-16">
          {/* Subtle Accent light inside CTA */}
          <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-96 -translate-x-1/2 rounded-full bg-gold/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 right-0 h-48 w-96 rounded-full bg-blue-500/5 blur-3xl" />

          <div className="relative z-10">
            {/* Heading image: Ready_To_Get_Started.png (2172 x 286) */}
            <h2 className="m-0">
              <img
                src="/Ready_To_Get_Started.png"
                alt="Ready to get started?"
                width={2172}
                height={286}
                loading="lazy"
                decoding="async"
                className="mx-auto block h-auto w-full max-w-[300px] sm:max-w-[420px] lg:max-w-[500px]"
              />
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-slate-500 sm:text-lg">
              Choose a service and pick a time that suits you best. Booking takes only a few simple steps.
            </p>
            <div className="mt-8 flex justify-center">
              <NavyGlassButton to="/book-appointment" className="w-full sm:w-auto">
                Book an Appointment
              </NavyGlassButton>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}