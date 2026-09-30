import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Eye, EyeOff, Loader2, Lock, Mail, MailCheck, Phone, ShieldCheck, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { api } from '../../lib/api';
import { normalizeIndianPhone } from '../../lib/phone';
import { useToast } from '../../lib/toast';
import AuthShell from './AuthShell';

const schema = z
  .object({
    full_name: z.string().trim().min(2, 'Enter your full name').max(100),
    email: z.string().trim().min(1, 'Enter your email').email('Enter a valid email'),
    phone: z
      .string()
      .trim()
      .refine((v) => normalizeIndianPhone(v) !== null, 'Enter a valid 10-digit mobile number'),
    password: z.string().min(8, 'Use at least 8 characters'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });
type F = z.infer<typeof schema>;

/* ------------------------------------------------------------------ */
/*  Form bits                                                          */
/* ------------------------------------------------------------------ */

const inputCls = (invalid: boolean) =>
  `h-12 w-full rounded-xl border bg-white/70 pl-11 text-[15px] text-slate-800 placeholder:text-slate-400 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur-md outline-none transition-all duration-300 focus:bg-white focus:ring-4 ${
    invalid
      ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15'
      : 'border-slate-200 hover:border-slate-300 focus:border-gold focus:ring-gold/15'
  }`;

const labelCls = 'text-[13px] font-semibold tracking-wide text-slate-700';
const iconCls =
  'pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400 transition-colors duration-300 group-focus-within:text-gold-dark';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon: ReactNode;
  error?: string;
  /** element pinned to the right inside the field (e.g. show/hide toggle) */
  trailing?: ReactNode;
  /** content rendered under the field, above the error (e.g. strength meter) */
  below?: ReactNode;
}

const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, icon, error, trailing, below, id, className = '', ...rest },
  ref,
) {
  const errId = `${id}-err`;
  return (
    <div>
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      <div className="group relative mt-1.5">
        <span className={iconCls} aria-hidden>
          {icon}
        </span>
        <input
          ref={ref}
          id={id}
          aria-invalid={!!error}
          aria-describedby={error ? errId : undefined}
          className={`${inputCls(!!error)} ${trailing ? 'pr-12' : 'pr-4'} ${className}`}
          {...rest}
        />
        {trailing}
      </div>
      {below}
      {error && (
        <p id={errId} role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-600">
          <span aria-hidden className="h-1 w-1 rounded-full bg-red-500" />
          {error}
        </p>
      )}
    </div>
  );
});

/* Visual-only strength hint (real rule stays: 8+ characters) */
function strengthOf(pw: string): { score: number; label: string } {
  if (!pw) return { score: 0, label: '' };
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw) && /\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const score = Math.max(1, s);
  return { score, label: ['', 'Weak', 'Fair', 'Good', 'Strong'][score]! };
}

const STRENGTH_COLOR = ['', 'bg-red-400', 'bg-amber-400', 'bg-lime-500', 'bg-emerald-500'];

function StrengthMeter({ password }: { password: string }) {
  const { score, label } = strengthOf(password);
  if (!password) return null;
  return (
    <div className="mt-2.5" aria-live="polite">
      <div className="flex gap-1.5" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              i <= score ? STRENGTH_COLOR[score] : 'bg-slate-200'
            }`}
          />
        ))}
      </div>
      <p className="mt-1.5 text-xs text-slate-500">
        Password strength: <span className="font-semibold text-slate-700">{label}</span>
      </p>
    </div>
  );
}

function EyeToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? 'Hide passwords' : 'Show passwords'}
      aria-pressed={shown}
      className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
    >
      {shown ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function Register() {
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<F>({ resolver: zodResolver(schema) });
  const toast = useToast();
  const nav = useNavigate();
  const loc = useLocation();
  const from = (loc.state as { from?: string } | null)?.from;

  const [sentTo, setSentTo] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);

  const pw = watch('password') ?? '';
  const confirm = watch('confirm') ?? '';
  const matches = confirm.length > 0 && confirm === pw && !errors.confirm;

  const onSubmit = async (v: F) => {
    // Stored as +91XXXXXXXXXX so the same number can be used to sign in later, in any typed format.
    const phone = normalizeIndianPhone(v.phone)!;

    // Friendly duplicate check (the database unique index is still the final guard).
    try {
      const { available } = await api<{ available: boolean }>('/auth/phone-available', { method: 'POST', body: { phone } });
      if (!available) return setError('phone', { message: 'This mobile number is already registered.' });
    } catch {
      /* server unreachable or rate-limited: continue, sign-up itself will still be protected by the unique index */
    }

    const { data, error } = await supabase.auth.signUp({
      email: v.email,
      password: v.password,
      options: { data: { full_name: v.full_name, phone } },
    });
    if (error)
      return toast.error(
        error.message.toLowerCase().includes('registered')
          ? 'An account with this email already exists.'
          : 'Unable to create your account. This email or mobile number may already be registered.',
      );
    if (data.session) {
      toast.success('Account created.');
      nav(from ?? '/dashboard');
    } else setSentTo(v.email);
  };

  /* ---- "check your email" state ---- */
  if (sentTo)
    return (
      <AuthShell title="Check your email" subtitle="We sent a confirmation link. Confirm your email, then sign in.">
        <div className="text-center">
          <div className="relative mx-auto h-20 w-20">
            <span
              aria-hidden
              className="absolute -inset-1.5 rounded-full bg-[conic-gradient(from_140deg,rgba(244,212,119,0.95),rgba(217,167,46,0.15),rgba(244,212,119,0.85),rgba(217,167,46,0.25),rgba(244,212,119,0.95))]"
            />
            <span className="relative grid h-full w-full place-items-center rounded-full bg-gradient-to-b from-white to-slate-50 shadow-[inset_0_2px_4px_rgba(255,255,255,1),0_10px_22px_-8px_rgba(15,23,42,0.25)]">
              <MailCheck className="h-9 w-9 text-gold-dark" strokeWidth={1.5} aria-hidden />
            </span>
          </div>

          <p className="mt-6 text-sm text-slate-500">Confirmation link sent to</p>
          <p className="mt-1 break-all rounded-xl border border-gold/20 bg-gold/5 px-4 py-2.5 text-sm font-semibold text-navy">
            {sentTo}
          </p>
          <p className="mt-4 text-xs leading-relaxed text-slate-400">
            Can’t find it? Check your spam or promotions folder.
          </p>

          <Link
            to="/login"
            state={from ? { from } : undefined}
            className="group mt-7 block w-full rounded-full bg-gradient-to-b from-gold-light via-gold to-gold-dark p-[1.5px] shadow-[0_10px_28px_-8px_rgba(217,167,46,0.6)] transition-all duration-500 hover:-translate-y-0.5 hover:shadow-[0_18px_38px_-10px_rgba(217,167,46,0.75)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 active:translate-y-0 active:scale-[0.99] motion-reduce:transition-none"
          >
            <span className="relative flex min-h-[52px] items-center justify-center gap-3 overflow-hidden rounded-full bg-gradient-to-b from-gold-light via-gold to-[#C99A25] px-6">
              <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/45 to-transparent" />
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/60 to-transparent transition-transform duration-[900ms] ease-out group-hover:translate-x-[320%] motion-reduce:hidden"
              />
              <span className="relative text-[15px] font-semibold tracking-wide text-navy-dark">Go to sign in</span>
              <ArrowRight
                aria-hidden
                className="relative h-4 w-4 -rotate-45 text-navy-dark transition-transform duration-500 group-hover:rotate-0"
              />
            </span>
          </Link>
        </div>
      </AuthShell>
    );

  /* ---- sign-up form ---- */
  return (
    <AuthShell title="Create your account" subtitle="You need an account to book an appointment.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <Field
          id="reg-name"
          label="Full name"
          icon={<User />}
          autoComplete="name"
          autoFocus
          placeholder="Your full name"
          error={errors.full_name?.message}
          {...register('full_name')}
        />

        <Field
          id="reg-email"
          label="Email"
          icon={<Mail />}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          error={errors.email?.message}
          {...register('email')}
        />

        <Field
          id="reg-phone"
          label="Mobile number"
          icon={<Phone />}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+91 98765 43210"
          error={errors.phone?.message}
          {...register('phone')}
        />

        <Field
          id="reg-password"
          label="Password"
          icon={<Lock />}
          type={showPw ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          error={errors.password?.message}
          trailing={<EyeToggle shown={showPw} onToggle={() => setShowPw((s) => !s)} />}
          below={<StrengthMeter password={pw} />}
          {...register('password')}
        />

        <Field
          id="reg-confirm"
          label="Confirm password"
          icon={<Lock />}
          type={showPw ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder="Re-enter your password"
          error={errors.confirm?.message}
          trailing={
            matches ? (
              <span
                aria-label="Passwords match"
                className="absolute right-3 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full bg-emerald-500 text-white"
              >
                <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
              </span>
            ) : undefined
          }
          {...register('confirm')}
        />

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
                <span className="relative text-[15px] font-semibold tracking-wide text-navy-dark">Creating account…</span>
              </>
            ) : (
              <>
                <span className="relative text-[15px] font-semibold tracking-wide text-navy-dark">Create account</span>
                <ArrowRight
                  aria-hidden
                  className="relative h-4 w-4 -rotate-45 text-navy-dark transition-transform duration-500 group-hover:rotate-0"
                />
              </>
            )}
          </span>
        </button>
      </form>

      {/* SECONDARY — back to sign in */}
      <div className="mt-7 flex items-center gap-4" aria-hidden>
        <span className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-200" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-400">Already registered?</span>
        <span className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-200" />
      </div>

      <Link
        to="/login"
        state={from ? { from } : undefined}
        className="group mt-5 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white/60 px-6 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-md transition-all duration-300 hover:border-gold/50 hover:bg-white hover:text-navy hover:shadow-[0_10px_24px_-12px_rgba(217,167,46,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
      >
        Sign in
        <ArrowRight aria-hidden className="h-4 w-4 text-gold-dark transition-transform duration-300 group-hover:translate-x-1" />
      </Link>

      <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-slate-400">
        <ShieldCheck aria-hidden className="h-3.5 w-3.5 text-gold-dark" />
        Your details are kept secure
      </p>
    </AuthShell>
  );
}