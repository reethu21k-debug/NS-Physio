import { forwardRef, useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { AlertTriangle, Inbox, Loader2, X } from 'lucide-react';
import { labelize } from '../lib/format';

type Variant = 'primary' | 'gold' | 'outline' | 'ghost' | 'danger';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-navy text-white hover:bg-navy-700',
  gold: 'bg-gold text-navy-dark hover:bg-gold-light font-semibold',
  outline: 'border border-navy/30 text-navy hover:bg-navy/5',
  ghost: 'text-navy hover:bg-navy/5',
  danger: 'bg-red-700 text-white hover:bg-red-800',
};
export function Button({ variant = 'primary', loading, className = '', children, disabled, ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button {...rest} disabled={disabled || loading}
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className}`}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{children}
    </button>
  );
}

interface FieldProps { label: string; error?: string; hint?: string }
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldProps>(function Input({ label, error, hint, className = '', ...rest }, ref) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="label">{label}</label>
      <input id={id} ref={ref} {...rest} aria-invalid={!!error} aria-describedby={error ? `${id}-e` : undefined} className="field" />
      {hint && !error && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      {error && <p id={`${id}-e`} role="alert" className="mt-1 text-sm text-red-700">{error}</p>}
    </div>
  );
});
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps>(function Textarea({ label, error, hint, className = '', ...rest }, ref) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="label">{label}</label>
      <textarea id={id} ref={ref} rows={3} {...rest} aria-invalid={!!error} aria-describedby={error ? `${id}-e` : undefined} className="field" />
      {hint && !error && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      {error && <p id={`${id}-e`} role="alert" className="mt-1 text-sm text-red-700">{error}</p>}
    </div>
  );
});
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & FieldProps>(function Select({ label, error, className = '', children, ...rest }, ref) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="label">{label}</label>
      <select id={id} ref={ref} {...rest} aria-invalid={!!error} className="field">{children}</select>
      {error && <p role="alert" className="mt-1 text-sm text-red-700">{error}</p>}
    </div>
  );
});

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  // Depends on `open` only: an inline onClose changes every render and would otherwise re-run this
  // effect on each keystroke and steal focus from inputs inside the dialog.
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { closeRef.current(); return; }
      if (e.key !== 'Tab' || !ref.current) return;
      const f = ref.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled])');
      if (!f.length) return;
      const first = f[0]!, last = f[f.length - 1]!, active = document.activeElement;
      if (e.shiftKey && (active === first || active === ref.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; if (prev?.isConnected) prev.focus(); };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-dark/60 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId}
        className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-6 sm:max-w-lg sm:rounded-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-xl">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger, loading, onConfirm, onClose }:
  { open: boolean; title: string; message: ReactNode; confirmLabel?: string; danger?: boolean; loading?: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="text-sm text-gray-700">{message}</div>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}

export const Spinner = ({ label = 'Loading…' }: { label?: string }) => (
  <div className="flex items-center justify-center gap-2 py-16 text-gray-600" role="status"><Loader2 className="h-5 w-5 animate-spin text-gold" /><span className="text-sm">{label}</span></div>
);
export const EmptyState = ({ title, action }: { title: string; action?: ReactNode }) => (
  <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-gray-300 bg-white px-4 py-12 text-center">
    <Inbox className="h-8 w-8 text-gray-400" aria-hidden /><p className="text-gray-600">{title}</p>{action}
  </div>
);
export const ErrorState = ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
  <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-10 text-center">
    <AlertTriangle className="h-8 w-8 text-red-600" aria-hidden /><p className="text-red-800">{message}</p>
    {onRetry && <Button variant="outline" onClick={onRetry}>Try again</Button>}
  </div>
);

const BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-900', submitted: 'bg-amber-100 text-amber-900', payment_submitted: 'bg-amber-100 text-amber-900',
  verified: 'bg-emerald-100 text-emerald-900', payment_verified: 'bg-emerald-100 text-emerald-900', confirmed: 'bg-emerald-100 text-emerald-900',
  rejected: 'bg-red-100 text-red-900', cancelled: 'bg-gray-200 text-gray-800', completed: 'bg-blue-100 text-blue-900',
};
const MARK: Record<string, string> = { verified: '✓', payment_verified: '✓', confirmed: '✓', rejected: '✕', cancelled: '✕', completed: '✓', pending: '●', submitted: '●', payment_submitted: '●' };
/** Colour + icon glyph + text: status is never conveyed by colour alone. */
export const StatusBadge = ({ status }: { status: string }) => (
  <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${BADGE[status] ?? 'bg-gray-100'}`}>
    <span aria-hidden>{MARK[status]}</span>{labelize(status)}
  </span>
);

export const PageTitle = ({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
    <div><h1 className="text-2xl sm:text-3xl">{title}</h1>{subtitle && <p className="mt-1 text-sm text-gray-600">{subtitle}</p>}</div>{action}
  </div>
);
export const DashboardCard = ({ label, value, accent }: { label: string; value: ReactNode; accent?: boolean }) => (
  <div className={`card ${accent ? 'border-gold/60 bg-gold/10' : ''}`}><p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p><p className="mt-2 font-display text-3xl text-navy">{value}</p></div>
);