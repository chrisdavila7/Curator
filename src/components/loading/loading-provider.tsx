"use client";

import * as React from "react";

type LoadingContextValue = {
  start: () => void;
  stop: () => void;
  withGlobalLoading: <T>(p: Promise<T>) => Promise<T>;
  count: number;
  visible: boolean;
};

const LoadingContext = React.createContext<LoadingContextValue | null>(null);

export function useGlobalLoading() {
  const ctx = React.useContext(LoadingContext);
  if (!ctx) {
    throw new Error("useGlobalLoading must be used within GlobalLoadingProvider");
  }
  return ctx;
}

type Props = {
  children: React.ReactNode;
  /**
   * Show delay in ms to avoid flicker on very fast operations
   */
  showDelayMs?: number;
  /**
   * Minimum visible duration in ms once shown to avoid flicker on rapid sequences
   */
  minVisibleMs?: number;
};

export function GlobalLoadingProvider({
  children,
  showDelayMs = 250,
  minVisibleMs = 300,
}: Props) {
  const [count, setCount] = React.useState(0);
  const [visible, setVisible] = React.useState(false);

  const showTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastShownAtRef = React.useRef<number | null>(null);

  const clearTimers = () => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  React.useEffect(() => {
    return () => clearTimers();
  }, []);

  React.useEffect(() => {
    clearTimers();

    if (count > 0) {
      // schedule show after delay (if not already visible)
      if (!visible) {
        showTimerRef.current = setTimeout(() => {
          setVisible(true);
          lastShownAtRef.current = Date.now();
        }, showDelayMs);
      }
    } else {
      // schedule hide respecting min visible time
      const elapsed = lastShownAtRef.current
        ? Date.now() - lastShownAtRef.current
        : Infinity;
      const remaining = Math.max(0, minVisibleMs - elapsed);

      hideTimerRef.current = setTimeout(() => {
        setVisible(false);
        lastShownAtRef.current = null;
      }, remaining);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, showDelayMs, minVisibleMs]);

  const start = React.useCallback(() => {
    setCount((c) => c + 1);
  }, []);

  const stop = React.useCallback(() => {
    setCount((c) => Math.max(0, c - 1));
  }, []);

  const withGlobalLoading = React.useCallback(
    async <T,>(p: Promise<T>) => {
      start();
      try {
        return await p;
      } finally {
        stop();
      }
    },
    [start, stop]
  );

  const value = React.useMemo<LoadingContextValue>(
    () => ({ start, stop, withGlobalLoading, count, visible }),
    [start, stop, withGlobalLoading, count, visible]
  );

  return (
    <LoadingContext.Provider value={value}>{children}</LoadingContext.Provider>
  );
}
