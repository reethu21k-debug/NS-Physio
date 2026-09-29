import type { Availability } from '../lib/types';
import { formatTime } from '../lib/format';
import { EmptyState } from './ui';

export function SlotPicker({ availability, value, onChange }: { availability: Availability; value: string | null; onChange: (start: string) => void }) {
  if (!availability.open) {
    const msg = availability.closedReason === 'closed' ? 'The clinic is closed on this date. Please choose another day.' : 'No appointments can be booked for this date.';
    return <EmptyState title={msg} />;
  }
  const groups = [['Morning', 'morning'], ['Evening', 'evening']] as const;
  return (
    <div className="space-y-5">
      {groups.map(([title, period]) => {
        const slots = availability.slots.filter((s) => s.period === period);
        if (!slots.length) return null;
        return (
          <fieldset key={period}>
            <legend className="mb-2 text-sm font-semibold text-navy">{title}</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {slots.map((s) => {
                const ok = s.state === 'available', sel = value === s.start;
                return (
                  <button key={s.start} type="button" disabled={!ok} aria-pressed={sel} onClick={() => onChange(s.start)}
                    className={`min-h-[48px] rounded-lg border px-2 py-2 text-sm transition-colors ${sel ? 'border-gold bg-gold font-bold text-navy-dark' : ok ? 'border-gray-300 bg-white hover:border-gold' : 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400 line-through'}`}>
                    {formatTime(s.start)}
                    {!ok && <span className="block text-[10px] font-normal no-underline">{s.state === 'booked' ? 'Booked' : s.state === 'blocked' ? 'Unavailable' : 'Passed'}</span>}
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}
      <p className="flex flex-wrap gap-4 text-xs text-gray-500"><span>■ <span className="text-gold-dark">Gold</span> = selected</span><span>■ White = available</span><span>■ Grey = unavailable</span></p>
    </div>
  );
}
