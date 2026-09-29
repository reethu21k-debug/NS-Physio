import { useState } from 'react';

/** Uses /logo.png (place the clinic's supplied logo in client/public/logo.png). Falls back to a text mark. */
export function Logo({ className = 'h-10', showText = true }: { className?: string; showText?: boolean }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="inline-flex items-center gap-2.5">
      {!failed && <img src="/logo.png" alt="NS Physio Clinic logo" className={`${className} w-auto`} onError={() => setFailed(true)} />}
      {(failed || showText) && (
        <span className="leading-tight">
          <span className="block font-display text-lg font-bold tracking-wide">NS PHYSIO</span>
          <span className="block text-[10px] font-semibold uppercase tracking-[0.25em] text-gold">Clinic</span>
        </span>
      )}
    </span>
  );
}
