'use client';
import { useEffect, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import clsx from 'clsx';
import { toast, ToastItem, ToastVariant } from '@/lib/toast';

const VARIANTS: Record<ToastVariant, { icon: typeof Info; tint: string; ring: string; bar: string }> = {
  success: { icon: CheckCircle2, tint: 'text-success-600', ring: 'ring-success-500/15', bar: 'bg-success-500' },
  error:   { icon: AlertCircle,  tint: 'text-alert-600',   ring: 'ring-alert-500/15',   bar: 'bg-alert-500' },
  info:    { icon: Info,         tint: 'text-navy-mid',    ring: 'ring-skyblue/25',     bar: 'bg-skyblue-300' },
};

const DURATION = 4500;

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    return toast.subscribe((t) => {
      setItems((prev) => [...prev, t].slice(-4)); // cap the stack
      setTimeout(() => dismiss(t.id), DURATION);
    });
  }, [dismiss]);

  if (!items.length) return null;

  return (
    <div className="pointer-events-none fixed top-4 right-4 z-[100] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2.5">
      {items.map((t) => {
        const v = VARIANTS[t.variant];
        const Icon = v.icon;
        return (
          <div
            key={t.id}
            role="status"
            className={clsx(
              'pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-2xl border border-hairline bg-surface px-4 py-3.5 shadow-floating ring-1 ring-inset animate-scale-in',
              v.ring,
            )}
          >
            <span className={clsx('absolute left-0 top-0 h-full w-1', v.bar)} />
            <Icon size={19} className={clsx('mt-0.5 flex-shrink-0', v.tint)} strokeWidth={2.2} />
            <p className="flex-1 text-body-md font-medium leading-snug text-ink">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-lg text-gray-400 transition-colors hover:bg-surfaceAlt hover:text-ink"
              aria-label="Dismiss"
            >
              <X size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
