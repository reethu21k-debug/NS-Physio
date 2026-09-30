import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Eye, EyeOff, Loader2, Lock, ShieldCheck, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { api, errMsg } from '../../lib/api';
import { normalizeIndianPhone } from '../../lib/phone';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import AuthShell from './AuthShell';

const schema = z
  .object({
    identifier: z.string().trim().min(1, 'Enter your email or mobile number'),
    password: z.string().min(1, 'Enter your password'),
  })
  .superRefine((v, ctx) => {
    const valid = v.identifier.includes('@')
      ? z.string().email().safeParse(v.identifier).success
      : normalizeIndianPhone(v.identifier) !== null;
    if (!valid)
      ctx.addIssue({ code: 'custom', path: ['identifier'], message: 'Enter a valid email or 10-digit mobile number' });
  });
type F = z.infer<typeof schema>;

/* Shared input styling: frosted field, gold focus ring, red when invalid */
const inputCls = (invalid: boolean) =>
  `h-12 w-full rounded-xl border bg-white/70 pl-11 text-[15px] text-slate-800 placeholder:text-slate-400 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur-md outline-none transition-all duration-300 focus:bg-white focus:ring-4 ${
    invalid
      ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15'
      : 'border-slate-200 hover:border-slate-300 focus:border-gold focus:ring-gold/15'
  }`;

const labelCls = 'text-[13px] font-semibold tracking-wide text-slate-700';

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-600">
      <span aria-hidden className="h-1 w-1 rounded-full bg-red-500" />
      {message}
    </p>
  );
}

export default function Login() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<F>({ resolver: zodResolver(schema) });
  const nav = useNavigate();
  const loc = useLocation();
  const toast = useToast();
  const { session, profile } = useAuth();
  const [showPw, setShowPw] = useState(false);
  const [capsOn, setCapsOn] = useState(false);

  const from = (loc.state as { from?: string } | null)?.from;
  if (session && profile) return <Navigate to={from ?? (profile.role === 'admin' ? '/admin' : '/dashboard')} replace />;

  const onSubmit = async (v: F) => {
    if (v.identifier.includes('@')) {
      // Email + password (unchanged behaviour)
      const { error } = await supabase.auth.signInWithPassword({ email: v.identifier, password: v.password });
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('invalid login credentials')) return toast.error('Incorrect email/mobile number or password.');
        if (msg.includes('email not confirmed')) return toast.error('Please verify your email before signing in.');
        return toast.error('Unable to sign in. Please try again.');
      }
    } else {
      // Mobile number + password: the server resolves the number to the account and verifies the password.
      try {
        const { session: s } = await api<{ session: { access_token: string; refresh_token: string } }>('/auth/login-phone', {
          method: 'POST',
          body: { phone: v.identifier, password: v.password },
        });
        const { error } = await supabase.auth.setSession(s);
        if (error) return toast.error('Unable to sign in. Please try again.');
      } catch (e) {
        return toast.error(errMsg(e));
      }
    }
    nav(from ?? '/dashboard', { replace: true });
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to book and manage your appointments.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {/* EMAIL OR MOBILE */}
        <div>
          <label htmlFor="login-identifier" className={labelCls}>
            Email or mobile number
          </label>
          <div className="group relative mt-1.5">
            <User
              aria-hidden
              className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400 transition-colors duration-300 group-focus-within:text-gold-dark"
            />
            <input
              id="login-identifier"
              type="text"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
              placeholder="you@example.com or 98765 43210"
              aria-invalid={!!errors.identifier}
              aria-describedby={errors.identifier ? 'login-identifier-err' : undefined}
              className={`${inputCls(!!errors.identifier)} pr-4`}
              {...register('identifier')}
            />
          </div>
          <FieldError id="login-identifier-err" message={errors.identifier?.message} />
        </div>

        {/* PASSWORD */}
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="login-password" className={labelCls}>
              Password
            </label>
            <Link
              to="/forgot-password"
              className="rounded text-xs font-semibold text-gold-dark transition-colors hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
            >
              Forgot password?
            </Link>
          </div>
          <div className="group relative mt-1.5">
            <Lock
              aria-hidden
              className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400 transition-colors duration-300 group-focus-within:text-gold-dark"
            />
            <input
              id="login-password"
              type={showPw ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter your password"
              aria-invalid={!!errors.password}
              aria-describedby={
                [errors.password ? 'login-password-err' : '', capsOn ? 'login-caps' : ''].filter(Boolean).join(' ') ||
                undefined
              }
              className={`${inputCls(!!errors.password)} pr-12`}
              onKeyUp={(e) => setCapsOn(e.getModifierState('CapsLock'))}
              {...register('password', { onBlur: () => setCapsOn(false) })}
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              aria-label={showPw ? 'Hide password' : 'Show password'}
              aria-pressed={showPw}
              className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
            >
              {showPw ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
            </button>
          </div>
          <FieldError id="login-password-err" message={errors.password?.message} />
          {capsOn && (
            <p
              id="login-caps"
              className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-amber-700"
            >
              <AlertTriangle aria-hidden className="h-3.5 w-3.5" />
              Caps Lock is on
            </p>
          )}
        </div>

        {/* SUBMIT — glossy gold pill */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="group relative block w-full rounded-full bg-gradient-to-b from-gold-light via-gold to-gold-dark p-[1.5px] shadow-[0_10px_28px_-8px_rgba(217,167,46,0.6)] transition-all duration-500 hover:-translate-y-0.5 hover:shadow-[0_18px_38px_-10px_rgba(217,167,46,0.75)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-80 disabled:hover:translate-y-0 motion-reduce:transition-none"
        >
          <span className="relative flex min-h-[52px] items-center justify-center gap-3 overflow-hidden rounded-full bg-gradient-to-b from-gold-light via-gold to-[#C99A25] px-6">
            <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/45 to-transparent" />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/60 to-transparent transition-transform duration-[900ms] ease-out group-hover:translate-x-[320%] motion-reduce:hidden"
            />
            {isSubmitting ? (
              <>
                <Loader2 className="relative h-4 w-4 animate-spin text-navy-dark" aria-hidden />
                <span className="relative text-[15px] font-semibold tracking-wide text-navy-dark">Signing in…</span>
              </>
            ) : (
              <>
                <span className="relative text-[15px] font-semibold tracking-wide text-navy-dark">Sign in</span>
                <ArrowRight
                  aria-hidden
                  className="relative h-4 w-4 -rotate-45 text-navy-dark transition-transform duration-500 group-hover:rotate-0"
                />
              </>
            )}
          </span>
        </button>
      </form>

      {/* SECONDARY — create account */}
      <div className="mt-7 flex items-center gap-4" aria-hidden>
        <span className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-200" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-400">New here?</span>
        <span className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-200" />
      </div>

      <Link
        to="/register"
        state={from ? { from } : undefined}
        className="group mt-5 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white/60 px-6 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-md transition-all duration-300 hover:border-gold/50 hover:bg-white hover:text-navy hover:shadow-[0_10px_24px_-12px_rgba(217,167,46,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
      >
        Create an account
        <ArrowRight aria-hidden className="h-4 w-4 text-gold-dark transition-transform duration-300 group-hover:translate-x-1" />
      </Link>

      <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-slate-400">
        <ShieldCheck aria-hidden className="h-3.5 w-3.5 text-gold-dark" />
        Secure sign-in
      </p>
    </AuthShell>
  );
}