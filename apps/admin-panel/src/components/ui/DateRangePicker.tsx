'use client';
import clsx from 'clsx';

interface Props {
  startDate: string;
  endDate: string;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
  onDark?: boolean;
}

export function DateRangePicker({ startDate, endDate, onStartChange, onEndChange, onDark }: Props) {
  const field = onDark
    ? 'rounded-xl bg-white/10 border border-white/20 text-white px-3.5 py-2 text-body-md outline-none transition-colors focus:border-white/50 focus:bg-white/15 [color-scheme:dark]'
    : 'input w-auto';
  return (
    <div className={clsx('flex items-center gap-2', onDark ? 'text-white' : '')}>
      <input type="date" value={startDate} onChange={e => onStartChange(e.target.value)} className={field} />
      <span className={clsx('text-body-md', onDark ? 'text-white/60' : 'text-gray-400')}>to</span>
      <input type="date" value={endDate} onChange={e => onEndChange(e.target.value)} className={field} />
    </div>
  );
}
