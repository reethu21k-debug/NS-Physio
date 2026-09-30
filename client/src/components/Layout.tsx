import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUp,
  CalendarCheck,
  CalendarDays,
  Clock,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Mail,
  MapPin,
  Menu,
  Phone,
  Settings,
  Stethoscope,
  User,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import type { PublicSettings } from '../lib/types';
import { Spinner } from './ui';

export function ProtectedRoute({ admin }: { admin?: boolean }) {
  const { session, profile, loading, profileLoading, profileFailed, refreshProfile, signOut } = useAuth();
  const loc = useLocation();

  if (loading) return <Spinner label="Checking your session…" />;
  if (!session) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;

  if (!profile) {
    if (profileLoading && !profileFailed) return <Spinner label="Checking your session…" />;
    return (
      <div role="alert" className="container-x max-w-md py-24 text-center">
        <h1 className="text-2xl">We couldn't load your account</h1>
        <p className="mt-2 text-sm text-gray-600">
          The server may be unavailable, or your account may be inactive. Please try again or sign out.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={() => void refreshProfile()}
            className="min-h-[44px] rounded-lg bg-gold px-5 text-sm font-semibold text-navy-dark hover:bg-gold-light"
          >
            Try again
          </button>
          <button
            onClick={() => void signOut()}
            className="min-h-[44px] rounded-lg border border-navy/30 px-5 text-sm text-navy hover:bg-navy/5"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (admin && profile?.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

/* ------------------------------------------------------------------ */
/*  SHARED BITS                                                        */
/* ------------------------------------------------------------------ */

/* Glossy gold pill (matches the hero button) */
function BookPill({ className = '', size = 'sm' }: { className?: string; size?: 'sm' | 'lg' }) {
  return (
    <Link
      to="/book-appointment"
      className={`group relative inline-flex rounded-full bg-gradient-to-b from-gold-light via-gold to-gold-dark p-[1.5px] shadow-[0_8px_22px_-8px_rgba(217,167,46,0.65)] transition-all duration-500 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-10px_rgba(217,167,46,0.85)] active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-light focus-visible:ring-offset-2 focus-visible:ring-offset-navy-dark motion-reduce:transition-none ${className}`}
    >
      <span
        className={`relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-full bg-gradient-to-b from-gold-light via-gold to-[#C99A25] ${
          size === 'lg' ? 'min-h-[48px] pl-6 pr-1.5' : 'min-h-[40px] px-3.5 sm:pl-5 sm:pr-1'
        }`}
      >
        {/* glossy top half */}
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/45 to-transparent" />
        {/* light sweep */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/60 to-transparent transition-transform duration-[900ms] ease-out group-hover:translate-x-[320%] motion-reduce:hidden"
        />
        <span
          className={`relative font-semibold tracking-wide text-navy-dark ${
            size === 'lg' ? 'text-[15px]' : 'text-[11px] sm:text-sm'
          }`}
        >
          Book Appointment
        </span>
        <span
          className={`relative place-items-center rounded-full bg-navy-dark text-gold-light shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_4px_10px_-2px_rgba(2,10,20,0.6)] transition-transform duration-500 group-hover:translate-x-0.5 ${
            size === 'lg' ? 'grid h-9 w-9' : 'hidden h-8 w-8 sm:grid'
          }`}
        >
          <ArrowRight className="h-4 w-4 -rotate-45 transition-transform duration-500 group-hover:rotate-0" />
        </span>
      </span>
    </Link>
  );
}

/* Desktop nav link: gold line grows from the centre on hover / stays lit when active */
function DesktopLink({ to, end, children }: { to: string; end?: boolean; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      end={end}
      className="group relative px-1 py-2 text-sm font-medium tracking-wide outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-gold/70"
    >
      {({ isActive }) => (
        <>
          <span
            className={`transition-colors duration-300 ${
              isActive ? 'text-gold-light' : 'text-white/80 group-hover:text-white'
            }`}
          >
            {children}
          </span>
          <span
            aria-hidden
            className={`absolute inset-x-0 -bottom-0.5 h-px origin-center bg-gradient-to-r from-transparent via-gold to-transparent transition-transform duration-500 ${
              isActive
                ? 'scale-x-100 shadow-[0_0_10px_rgba(217,167,46,0.9)]'
                : 'scale-x-0 group-hover:scale-x-100'
            }`}
          />
        </>
      )}
    </NavLink>
  );
}

/* ------------------------------------------------------------------ */
/*  NAVBAR                                                             */
/* ------------------------------------------------------------------ */

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { session, profile, signOut } = useAuth();
  const links = [
    ['/', 'Home'],
    ['/services', 'Services'],
    ['/about', 'About'],
    ['/contact', 'Contact'],
  ] as const;

  const accountTo = profile?.role === 'admin' ? '/admin' : '/dashboard';
  const accountLabel = profile?.role === 'admin' ? 'Admin' : 'Dashboard';

  /* shrink + deepen blur once the page scrolls */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* Esc closes the mobile menu */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const mobileLinkCls = ({ isActive }: { isActive: boolean }) =>
    `group flex items-center gap-4 border-b border-white/5 py-3.5 text-base font-medium transition-colors ${
      isActive ? 'text-gold-light' : 'text-white/85 hover:text-white'
    }`;

  const mobileItems: [string, string][] = [
    ...links.map(([to, l]) => [to, l] as [string, string]),
    session ? [accountTo, accountLabel] : ['/login', 'Login'],
  ];

  return (
    <header
      className={`sticky top-0 z-50 w-full overflow-hidden text-white backdrop-blur-xl backdrop-saturate-150 transition-all duration-500 ${
        scrolled
          ? 'bg-navy-dark/90 shadow-[0_14px_40px_-14px_rgba(2,10,20,0.8)]'
          : 'bg-navy-dark/95 shadow-[0_8px_30px_-12px_rgba(2,10,20,0.5)]'
      }`}
    >
      {/* top sheen + ambient glow + bottom gold hairline */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 h-20 w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />

      <div
        className={`container-x relative grid grid-cols-[1fr_auto_1fr] items-center transition-[height] duration-500 ${
          scrolled ? 'h-16' : 'h-20'
        }`}
      >
        {/* Left: nav links (desktop) / menu toggle (mobile) */}
        <div className="flex items-center justify-start">
          <button
            className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 text-white transition-colors hover:border-gold/40 hover:bg-white/10 md:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen(!open)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <nav className="hidden items-center gap-7 md:flex" aria-label="Main">
            {links.map(([to, l]) => (
              <DesktopLink key={to} to={to} end={to === '/'}>
                {l}
              </DesktopLink>
            ))}
          </nav>
        </div>

        {/* Centre: logo with soft halo */}
        <div className="flex items-center justify-center px-2">
          <Link to="/" aria-label="NS Physio Clinic home" className="group relative flex items-center justify-center">
            <span
              aria-hidden
              className="absolute inset-0 m-auto h-14 w-14 rounded-full bg-gold/0 blur-xl transition-colors duration-500 group-hover:bg-gold/30"
            />
            <img
              src="/Logo.png"
              alt="NS Physio Clinic Logo"
              className={`relative w-auto object-contain transition-all duration-500 group-hover:scale-105 ${
                scrolled ? 'h-10 sm:h-11' : 'h-12 sm:h-14'
              }`}
            />
          </Link>
        </div>

        {/* Right: auth + CTA */}
        <div className="flex items-center justify-end gap-3 sm:gap-5">
          <div className="hidden items-center gap-6 md:flex">
            {session ? (
              <>
                <DesktopLink to={accountTo}>{accountLabel}</DesktopLink>
                <button
                  onClick={() => void signOut()}
                  className="text-sm font-medium tracking-wide text-white/70 transition-colors hover:text-gold-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70"
                >
                  Logout
                </button>
              </>
            ) : (
              <DesktopLink to="/login">Login</DesktopLink>
            )}
          </div>

          <BookPill />
        </div>
      </div>

      {/* Mobile drawer: slides open / closed */}
      <div
        id="mobile-nav"
        className={`relative grid transition-[grid-template-rows,opacity,visibility] duration-500 ease-out md:hidden ${
          open ? 'visible grid-rows-[1fr] opacity-100' : 'invisible grid-rows-[0fr] opacity-0'
        }`}
      >
        <nav
          className="overflow-hidden"
          aria-label="Mobile Navigation"
          onClick={() => setOpen(false)}
        >
          <div className="border-t border-white/10 px-6 pb-6 pt-2">
            <div className="flex flex-col">
              {mobileItems.map(([to, l], i) => (
                <NavLink key={to} to={to} end={to === '/'} className={mobileLinkCls}>
                  <span className="text-[11px] font-semibold tracking-[0.25em] text-gold/70">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {l}
                </NavLink>
              ))}
              {session && (
                <button
                  className="group flex items-center gap-4 border-b border-white/5 py-3.5 text-left text-base font-medium text-white/70 transition-colors hover:text-gold-light"
                  onClick={() => void signOut()}
                >
                  <span className="text-[11px] font-semibold tracking-[0.25em] text-gold/70">
                    {String(mobileItems.length + 1).padStart(2, '0')}
                  </span>
                  Logout
                </button>
              )}
            </div>
            <BookPill size="lg" className="mt-5 w-full" />
          </div>
        </nav>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/*  FOOTER                                                             */
/* ------------------------------------------------------------------ */

const FOOTER_LINKS = [
  ['/services', 'Services'],
  ['/about', 'About'],
  ['/contact', 'Contact'],
  ['/book-appointment', 'Book Appointment'],
] as const;

/* Outlined watermark text, dissolving downwards */
const WATERMARK_STYLE: CSSProperties = {
  WebkitTextStroke: '1px rgba(217,167,46,0.22)',
  color: 'transparent',
  WebkitMaskImage: 'linear-gradient(to bottom, #000 15%, transparent 95%)',
  maskImage: 'linear-gradient(to bottom, #000 15%, transparent 95%)',
};

function FooterHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-5 flex items-center gap-3 font-sans text-xs font-semibold uppercase tracking-[0.25em] text-gold">
      {children}
      <span aria-hidden className="h-px w-8 bg-gradient-to-r from-gold/70 to-transparent" />
    </h3>
  );
}

/* Frosted glass contact row */
function ContactRow({ icon, href, children }: { icon: ReactNode; href?: string; children: ReactNode }) {
  const cls =
    'group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-md transition-all duration-300 hover:border-gold/30 hover:bg-white/[0.07]';
  const inner = (
    <>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-gold/30 bg-gold/10 text-gold transition-colors duration-300 group-hover:bg-gold group-hover:text-navy-dark">
        {icon}
      </span>
      <span className="min-w-0 break-words text-sm leading-snug text-gray-300 transition-colors group-hover:text-white">
        {children}
      </span>
    </>
  );
  return href ? (
    <a href={href} className={cls}>
      {inner}
    </a>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export function Footer() {
  const s = useAsync(() => api<PublicSettings>('/settings'));
  return (
    <footer className="relative overflow-hidden bg-navy-dark text-gray-300">
      {/* ambient glows + top hairline */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute -left-24 -top-32 h-72 w-72 rounded-full bg-gold/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 -right-24 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />

      <div className="container-x relative grid gap-12 py-14 md:grid-cols-12 md:gap-8 md:py-16">
        {/* Brand */}
        <div className="md:col-span-5">
          <Link to="/" className="inline-block">
            <img src="/Logo.png" alt="NS Physio Clinic Logo" className="h-14 w-auto object-contain" />
          </Link>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-gray-400">
            Professional physiotherapy and rehabilitation care, tailored to help you recover and move with confidence.
          </p>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Move Better • Feel Better • Live Better
          </p>
          <BookPill size="lg" className="mt-7" />
        </div>

        {/* Explore */}
        <div className="md:col-span-3">
          <FooterHeading>Explore</FooterHeading>
          <ul className="space-y-3 text-sm">
            {FOOTER_LINKS.map(([to, l]) => (
              <li key={to}>
                <Link
                  to={to}
                  className="group inline-flex items-center gap-2 text-gray-400 transition-colors duration-300 hover:text-white focus-visible:outline-none focus-visible:text-gold-light"
                >
                  <span
                    aria-hidden
                    className="h-px w-0 bg-gold transition-all duration-300 group-hover:w-4"
                  />
                  {l}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact */}
        <div className="md:col-span-4">
          <FooterHeading>Contact</FooterHeading>
          <div className="space-y-3">
            {s.data?.phone && (
              <ContactRow icon={<Phone className="h-4 w-4" />} href={`tel:${s.data.phone.replace(/\s+/g, '')}`}>
                {s.data.phone}
              </ContactRow>
            )}
            {s.data?.email && (
              <ContactRow icon={<Mail className="h-4 w-4" />} href={`mailto:${s.data.email}`}>
                {s.data.email}
              </ContactRow>
            )}
            {s.data?.address && (
              <ContactRow icon={<MapPin className="h-4 w-4" />}>{s.data.address}</ContactRow>
            )}
            {!s.data?.phone && !s.data?.email && !s.data?.address && (
              <p className="text-sm text-gray-500">Contact details coming soon.</p>
            )}
          </div>
        </div>
      </div>

      {/* Oversized outlined watermark, cropped + faded at the bottom */}
      <div
        aria-hidden
        className="pointer-events-none relative h-[8vw] select-none overflow-hidden text-center md:h-[5.5vw]"
      >
        <span
          className="block whitespace-nowrap font-display text-[13vw] font-bold uppercase leading-none tracking-tight md:text-[9vw]"
          style={WATERMARK_STYLE}
        >
          NS Physio
        </span>
      </div>

      {/* Bottom bar */}
      <div className="relative">
        <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        <div className="container-x flex flex-col items-center justify-between gap-4 py-5 text-xs text-gray-500 sm:flex-row">
          <p>
            © {new Date().getFullYear()} {s.data?.clinic_name ?? 'NS Physio Clinic'}. All rights reserved.
          </p>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-400 backdrop-blur-md transition-all duration-300 hover:border-gold/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70"
          >
            Back to top
            <ArrowUp className="h-3.5 w-3.5 text-gold transition-transform duration-300 group-hover:-translate-y-0.5" />
          </button>
        </div>
      </div>
    </footer>
  );
}

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-gold focus:p-2">
        Skip to content
      </a>
      <Navbar />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

interface SideItem {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
}

function Shell({ items, title }: { items: SideItem[]; title: string }) {
  const [open, setOpen] = useState(false);
  const { profile, signOut } = useAuth();
  const nav = (
    <nav className="flex flex-col gap-1 p-3" aria-label={title} onClick={() => setOpen(false)}>
      {items.map((i) => (
        <NavLink
          key={i.to}
          to={i.to}
          end={i.end}
          className={({ isActive }) =>
            `flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm ${
              isActive ? 'bg-gold font-semibold text-navy-dark' : 'text-gray-200 hover:bg-white/10'
            }`
          }
        >
          {i.icon}
          {i.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-surface md:flex">
      <aside className="hidden w-60 shrink-0 bg-navy text-white md:block">
        <div className="border-b border-white/10 p-4">
          <Link to="/" className="inline-block">
            <img src="/Logo.png" alt="NS Physio Clinic Logo" className="h-10 w-auto object-contain" />
          </Link>
          <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-gold">{title}</p>
        </div>
        {nav}
      </aside>
      <div className="flex-1">
        <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-white/90 backdrop-blur-md px-4">
          <button className="rounded p-2 md:hidden" aria-label="Open menu" onClick={() => setOpen(true)}>
            <Menu />
          </button>
          <span className="hidden text-sm text-gray-600 md:block">{profile?.full_name}</span>
          <Link to="/" className="md:hidden">
            <img src="/Logo.png" alt="NS Physio Clinic Logo" className="h-8 w-auto object-contain" />
          </Link>
          <button
            onClick={() => void signOut()}
            className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm hover:bg-gray-100"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
        {open && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-navy-dark/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-64 bg-navy text-white">
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <img src="/Logo.png" alt="NS Physio Clinic Logo" className="h-9 w-auto object-contain" />
                <button aria-label="Close menu" onClick={() => setOpen(false)}>
                  <X />
                </button>
              </div>
              {nav}
            </div>
          </div>
        )}
        <main className="container-x py-6 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

const ic = 'h-4 w-4';

export const UserLayout = () => (
  <Shell
    title="My Account"
    items={[
      { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className={ic} /> },
      { to: '/book-appointment', label: 'Book Appointment', icon: <CalendarDays className={ic} /> },
      { to: '/appointments', label: 'My Appointments', icon: <CalendarCheck className={ic} /> },
      { to: '/profile', label: 'Profile', icon: <User className={ic} /> },
    ]}
  />
);

export const AdminLayout = () => (
  <Shell
    title="Admin"
    items={[
      { to: '/admin', label: 'Dashboard', icon: <LayoutDashboard className={ic} />, end: true },
      { to: '/admin/appointments', label: 'Appointments', icon: <CalendarCheck className={ic} /> },
      { to: '/admin/payments', label: 'Payments', icon: <CreditCard className={ic} /> },
      { to: '/admin/services', label: 'Services', icon: <Stethoscope className={ic} /> },
      { to: '/admin/time-slots', label: 'Time Slots', icon: <Clock className={ic} /> },
      { to: '/admin/users', label: 'Users', icon: <Users className={ic} /> },
      { to: '/admin/settings', label: 'Settings', icon: <Settings className={ic} /> },
    ]}
  />
);