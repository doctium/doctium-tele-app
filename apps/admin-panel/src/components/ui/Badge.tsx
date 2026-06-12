import clsx from 'clsx';

type Variant = 'success' | 'warning' | 'danger' | 'info' | 'default';

const map: Record<Variant, string> = {
  success: 'bg-success-50 text-success-600 ring-success-500/20',
  warning: 'bg-caution-50 text-caution-600 ring-caution-500/20',
  danger:  'bg-alert-50 text-alert-600 ring-alert-500/20',
  info:    'bg-skyblue-50 text-navy-mid ring-skyblue/30',
  default: 'bg-surfaceAlt text-gray-500 ring-gray-400/15',
};

const dot: Record<Variant, string> = {
  success: 'bg-success-500',
  warning: 'bg-caution-500',
  danger:  'bg-alert-500',
  info:    'bg-skyblue-300',
  default: 'bg-gray-400',
};

export function Badge({ label, variant = 'default', dot: showDot = true }: { label: string; variant?: Variant; dot?: boolean }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-micro font-bold ring-1 ring-inset', map[variant])}>
      {showDot && <span className={clsx('h-1.5 w-1.5 rounded-full', dot[variant])} />}
      {label}
    </span>
  );
}

export function statusBadge(status: string) {
  const map: Record<string, { label: string; variant: Variant }> = {
    PENDING:   { label: 'Pending',   variant: 'warning' },
    CONFIRMED: { label: 'Confirmed', variant: 'info' },
    COMPLETED: { label: 'Completed', variant: 'success' },
    CANCELLED: { label: 'Cancelled', variant: 'danger' },
    ACCEPTED:  { label: 'Accepted',  variant: 'success' },
    DECLINED:  { label: 'Declined',  variant: 'danger' },
    ACTIVE:    { label: 'Active',    variant: 'success' },
    INACTIVE:  { label: 'Inactive',  variant: 'default' },
    SOLVED:    { label: 'Solved',    variant: 'success' },
  };
  const config = map[status] ?? { label: status, variant: 'default' as Variant };
  return <Badge label={config.label} variant={config.variant} />;
}
