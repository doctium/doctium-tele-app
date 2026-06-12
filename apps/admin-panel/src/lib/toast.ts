// Tiny framework-agnostic toast bus so non-React modules (e.g. the axios
// interceptor) can raise toasts. The <Toaster/> component subscribes to it.
export type ToastVariant = 'success' | 'error' | 'info';
export interface ToastItem { id: number; message: string; variant: ToastVariant; }

type Listener = (toast: ToastItem) => void;
const listeners = new Set<Listener>();
let counter = 0;
let last = { key: '', at: 0 };

function emit(message: string, variant: ToastVariant) {
  // Collapse identical messages fired in a burst (e.g. several parallel
  // requests failing at once) into a single toast.
  const key = `${variant}:${message}`;
  const now = Date.now();
  if (key === last.key && now - last.at < 1500) return;
  last = { key, at: now };

  counter += 1;
  const item: ToastItem = { id: counter, message, variant };
  listeners.forEach((l) => l(item));
}

export const toast = {
  success: (message: string) => emit(message, 'success'),
  error: (message: string) => emit(message, 'error'),
  info: (message: string) => emit(message, 'info'),
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
};
