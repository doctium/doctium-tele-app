import { LucideIcon } from 'lucide-react';
import clsx from 'clsx';

interface Props {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red';
  href?: string;
}

const colorMap: Record<NonNullable<Props['color']>, { tile: string; glow: string }> = {
  blue:   { tile: 'bg-gradient-navy',                                       glow: 'bg-skyblue/25' },
  green:  { tile: 'bg-gradient-teal',                                       glow: 'bg-teal-500/25' },
  purple: { tile: 'bg-gradient-to-br from-[#5B7CC4] to-[#37528C]',          glow: 'bg-[#5B7CC4]/25' },
  orange: { tile: 'bg-gradient-to-br from-[#F7A93D] to-[#E07B1A]',          glow: 'bg-caution-500/25' },
  red:    { tile: 'bg-gradient-to-br from-[#F0675C] to-[#C9352A]',          glow: 'bg-alert-500/25' },
};

export function StatsCard({ title, value, icon: Icon, color = 'blue', href }: Props) {
  const c = colorMap[color];
  const content = (
    <div className="group relative overflow-hidden card card-hover cursor-pointer">
      {/* soft corner glow */}
      <div className={clsx('pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full blur-2xl opacity-70 transition-opacity duration-300 group-hover:opacity-100', c.glow)} />
      {/* Title wraps (never truncates) and the value scales down before the
          card narrows — every stat must be readable at a glance. */}
      <div className="relative flex items-center gap-3.5">
        <div className={clsx('grid place-items-center w-12 h-12 rounded-2xl flex-shrink-0 text-white shadow-cta-navy transition-transform duration-300 group-hover:scale-105', c.tile)}>
          <Icon size={21} strokeWidth={2.2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide leading-snug">{title}</p>
          <p className="text-heading-md xl:text-heading-lg font-extrabold text-ink mt-1 leading-none tabular-nums break-words">{value}</p>
        </div>
      </div>
    </div>
  );

  if (href) return <a href={href} className="block">{content}</a>;
  return content;
}
