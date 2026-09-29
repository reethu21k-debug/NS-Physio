import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const pad = (n: number) => String(n).padStart(2, '0');

/** Date-string based calendar (no JS Date timezone shifting). */
export function Calendar({ value, min, max, onChange }: { value: string | null; min: string; max: string; onChange: (d: string) => void }) {
  const [ym, setYm] = useState(() => { const [y, m] = (value ?? min).split('-').map(Number); return { y: y ?? 2026, m: (m ?? 1) - 1 }; });
  const cells = useMemo(() => {
    const first = new Date(Date.UTC(ym.y, ym.m, 1)).getUTCDay();
    const days = new Date(Date.UTC(ym.y, ym.m + 1, 0)).getUTCDate();
    return [...Array<null>(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  }, [ym]);
  const key = (d: number) => `${ym.y}-${pad(ym.m + 1)}-${pad(d)}`;
  const prevDisabled = `${ym.y}-${pad(ym.m + 1)}-01` <= min;
  const nextDisabled = `${ym.m === 11 ? ym.y + 1 : ym.y}-${pad(ym.m === 11 ? 1 : ym.m + 2)}-01` > max;
  const shift = (n: number) => setYm(({ y, m }) => { const t = m + n; return { y: y + Math.floor(t / 12), m: ((t % 12) + 12) % 12 }; });

  return (
    <div className="card p-3 sm:p-4" role="group" aria-label="Choose appointment date">
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => shift(-1)} disabled={prevDisabled} aria-label="Previous month" className="rounded-lg p-2 hover:bg-gray-100 disabled:opacity-30"><ChevronLeft className="h-5 w-5" /></button>
        <p className="font-semibold text-navy">{MONTHS[ym.m]} {ym.y}</p>
        <button type="button" onClick={() => shift(1)} disabled={nextDisabled} aria-label="Next month" className="rounded-lg p-2 hover:bg-gray-100 disabled:opacity-30"><ChevronRight className="h-5 w-5" /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500">{['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => <span key={d} className="py-1">{d}</span>)}</div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <span key={`e${i}`} />;
          const k = key(d), disabled = k < min || k > max, sel = k === value;
          return (
            <button key={k} type="button" disabled={disabled} onClick={() => onChange(k)} aria-pressed={sel} aria-label={k}
              className={`aspect-square min-h-[40px] rounded-lg text-sm transition-colors ${sel ? 'bg-gold font-bold text-navy-dark' : k === min ? 'border border-gold/60' : ''} ${disabled ? 'cursor-not-allowed text-gray-300' : !sel ? 'hover:bg-gold/20' : ''}`}>{d}</button>
          );
        })}
      </div>
    </div>
  );
}
