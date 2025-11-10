"use client";

import * as React from "react";

type ToastVariant = "default" | "destructive";
type Toast = {
  id: number;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number; // ms
};

type ToastContextValue = {
  toast: (t: Omit<Toast, "id">) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const toast = React.useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const duration = t.duration ?? 4000;
    const next: Toast = { id, ...t };
    setToasts((prev) => [...prev, next]);

    // auto-dismiss
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, Math.max(1000, duration));
  }, []);

  const value = React.useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Render toasts at the end so they sit on top of the app */}
      <Toaster toasts={toasts} />
    </ToastContext.Provider>
  );
}

export function Toaster({ toasts }: { toasts: Toast[] }) {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed top-4 right-4 z-50 flex w-full max-w-[420px] flex-col gap-2"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={[
            "pointer-events-auto rounded-md border shadow-lg p-3 text-sm",
            "bg-white text-neutral-900 border-neutral-200",
            "dark:bg-neutral-900 dark:text-neutral-50 dark:border-neutral-800",
            t.variant === "destructive"
              ? "border-red-300/60 bg-red-50 text-red-900 dark:bg-red-900/30 dark:text-red-100 dark:border-red-800"
              : "",
          ].join(" ")}
        >
          {t.title ? <div className="font-semibold">{t.title}</div> : null}
          {t.description ? (
            <div className="mt-0.5 text-[0.9rem] text-neutral-600 dark:text-neutral-300">{t.description}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
