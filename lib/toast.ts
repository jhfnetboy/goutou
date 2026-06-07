// Tiny toast bus. Importable from anywhere — components subscribe via the
// <Toaster /> mounted near the root.

export type ToastVariant = "default" | "success" | "danger";

export type ToastItem = {
  id: string;
  message: string;
  variant: ToastVariant;
};

type Listener = (item: ToastItem) => void;

const listeners = new Set<Listener>();
let counter = 0;

export function toast(message: string, variant: ToastVariant = "default") {
  const item: ToastItem = {
    id: `toast-${Date.now()}-${++counter}`,
    message,
    variant,
  };
  for (const listener of listeners) listener(item);
  return item.id;
}

export function subscribeToToasts(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
