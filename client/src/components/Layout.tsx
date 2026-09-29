import { useState, type ReactNode } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import {
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

const navCls = ({ isActive }: { isActive: boolean }) =>
  `rounded px-1 py-2 text-sm font-medium transition-colors hover:text-gold-light ${
    isActive ? 'text-gold font-semibold' : 'text-white/90'
  }`;

export function Navbar() {
  const [open, setOpen] = useState(false);
  const { session, profile, signOut } = useAuth();
  const links = [
    ['/', 'Home'],
    ['/services', 'Services'],
    ['/about', 'About'],
    ['/contact', 'Contact'],
  ] as const;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gold/30 bg-navy-dark/95 backdrop-blur-md shadow-xl shadow-navy-dark/30 text-white transition-all duration-300">
      <div className="container-x grid h-20 grid-cols-3 items-center">
        {/* Left Section: Nav Links (Desktop) / Mobile Toggle */}
        <div className="flex items-center justify-start">
          <button
            className="rounded-lg p-2 text-white hover:bg-white/10 md:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>

          <nav className="hidden items-center gap-6 md:flex" aria-label="Main">
            {links.map(([to, l]) => (
              <NavLink key={to} to={to} end={to === '/'} className={navCls}>
                {l}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Center Section: Centered Logo */}
        <div className="flex items-center justify-center">
          <Link to="/" aria-label="NS Physio Clinic home" className="flex items-center justify-center">
            <img
              src="/Logo.png"
              alt="NS Physio Clinic Logo"
              className="h-12 w-auto object-contain transition-transform duration-300 hover:scale-105 sm:h-14"
            />
          </Link>
        </div>

        {/* Right Section: Auth Action / CTA Button */}
        <div className="flex items-center justify-end gap-3 sm:gap-4">
          <div className="hidden items-center gap-5 md:flex">
            {session ? (
              <>
                <NavLink
                  to={profile?.role === 'admin' ? '/admin' : '/dashboard'}
                  className={navCls}
                >
                  {profile?.role === 'admin' ? 'Admin' : 'Dashboard'}
                </NavLink>
                <button
                  onClick={() => void signOut()}
                  className="text-sm font-medium text-white/90 transition-colors hover:text-gold-light"
                >
                  Logout
                </button>
              </>
            ) : (
              <NavLink to="/login" className={navCls}>
                Login
              </NavLink>
            )}
          </div>

          <Link
            to="/book-appointment"
            className="rounded-lg bg-gold px-3.5 py-2 text-xs font-semibold text-navy-dark shadow-md transition-all hover:bg-gold-light hover:shadow-gold/20 sm:px-4 sm:py-2.5 sm:text-sm"
          >
            Book Appointment
          </Link>
        </div>
      </div>

      {/* Responsive Mobile Drawer Navigation */}
      {open && (
        <nav
          className="border-t border-white/10 bg-navy-dark/98 backdrop-blur-xl px-6 pb-6 pt-3 md:hidden"
          aria-label="Mobile Navigation"
          onClick={() => setOpen(false)}
        >
          <div className="flex flex-col gap-1">
            {links.map(([to, l]) => (
              <NavLink key={to} to={to} end={to === '/'} className={`${navCls} py-3 text-base border-b border-white/5`}>
                {l}
              </NavLink>
            ))}
            {session ? (
              <>
                <NavLink
                  to={profile?.role === 'admin' ? '/admin' : '/dashboard'}
                  className={`${navCls} py-3 text-base border-b border-white/5`}
                >
                  {profile?.role === 'admin' ? 'Admin' : 'Dashboard'}
                </NavLink>
                <button
                  className="py-3 text-left text-base font-medium text-white/90 hover:text-gold-light border-b border-white/5"
                  onClick={() => void signOut()}
                >
                  Logout
                </button>
              </>
            ) : (
              <NavLink to="/login" className={`${navCls} py-3 text-base border-b border-white/5`}>
                Login
              </NavLink>
            )}
            <Link
              to="/book-appointment"
              className="mt-4 rounded-lg bg-gold px-4 py-3 text-center text-sm font-semibold text-navy-dark shadow-md"
            >
              Book Appointment
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}

export function Footer() {
  const s = useAsync(() => api<PublicSettings>('/settings'));
  return (
    <footer className="bg-navy-dark text-gray-300">
      <div className="container-x grid gap-8 py-10 md:grid-cols-3">
        <div>
          <Link to="/" className="inline-block">
            <img src="/Logo.png" alt="NS Physio Clinic Logo" className="h-12 w-auto object-contain" />
          </Link>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Move Better • Feel Better • Live Better
          </p>
        </div>
        <div>
          <h3 className="mb-3 font-sans text-sm font-semibold uppercase tracking-wide text-gold">Explore</h3>
          <ul className="space-y-2 text-sm">
            {[
              ['/services', 'Services'],
              ['/about', 'About'],
              ['/contact', 'Contact'],
              ['/book-appointment', 'Book Appointment'],
            ].map(([to, l]) => (
              <li key={to}>
                <Link to={to!} className="hover:text-gold-light">
                  {l}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-2 text-sm">
          <h3 className="mb-3 font-sans text-sm font-semibold uppercase tracking-wide text-gold">Contact</h3>
          {s.data?.phone && (
            <p className="flex gap-2">
              <Phone className="h-4 w-4 shrink-0 text-gold" />
              {s.data.phone}
            </p>
          )}
          {s.data?.email && (
            <p className="flex gap-2">
              <Mail className="h-4 w-4 shrink-0 text-gold" />
              {s.data.email}
            </p>
          )}
          {s.data?.address && (
            <p className="flex gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-gold" />
              {s.data.address}
            </p>
          )}
          {!s.data?.phone && !s.data?.email && !s.data?.address && (
            <p className="text-gray-500">Contact details coming soon.</p>
          )}
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} {s.data?.clinic_name ?? 'NS Physio Clinic'}. All rights reserved.
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