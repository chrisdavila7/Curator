"use client";

import * as React from "react";

export type LottieOverlayOptions = {
  data?: object;
  url?: string;
  loop?: boolean;
  autoplay?: boolean;
  speed?: number;
  spinner?: boolean;
  onClose?: (reason: "complete" | "dismissed") => void;
};

type LottieOverlayContextType = {
  isOpen: boolean;
  animationData: object | null;
  spinner: boolean;
  loop: boolean;
  autoplay: boolean;
  speed?: number;
  version: number;
  open: (opts: LottieOverlayOptions) => Promise<boolean>;
  close: () => void;
  closeWith?: (reason: "complete" | "dismissed") => void;
};

const LottieOverlayContext = React.createContext<LottieOverlayContextType | null>(
  null
);

export function useLottieOverlay(): LottieOverlayContextType {
  const ctx = React.useContext(LottieOverlayContext);
  if (!ctx) {
    throw new Error("useLottieOverlay must be used within LottieOverlayProvider");
  }
  return ctx;
}

export function LottieOverlayProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [animationData, setAnimationData] = React.useState<object | null>(null);
  const [spinner, setSpinner] = React.useState<boolean>(false);
  const [loop, setLoop] = React.useState<boolean>(false);
  const [autoplay, setAutoplay] = React.useState<boolean>(true);
  const [speed, setSpeed] = React.useState<number | undefined>(undefined);
  const [version, setVersion] = React.useState<number>(0);
  const onCloseRef = React.useRef<((reason: "complete" | "dismissed") => void) | undefined>(undefined);

  const getPrefersReducedMotion = React.useCallback(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  }, []);

  const closeWith = React.useCallback((reason: "complete" | "dismissed") => {
    setIsOpen(false);
    setSpinner(false);
    // Defer clearing animationData to allow unmount cleanup in overlay
    setTimeout(() => setAnimationData(null), 0);
    const cb = onCloseRef.current;
    onCloseRef.current = undefined;
    try {
      cb?.(reason);
    } catch {
      // ignore callback errors
    }
  }, []);

  const close = React.useCallback(() => {
    closeWith("dismissed");
  }, [closeWith]);

  const open = React.useCallback(
    async (opts: LottieOverlayOptions) => {
      const reduced = getPrefersReducedMotion();
      const finalLoop = typeof opts.loop === "boolean" ? opts.loop : false;
      const finalAutoplay =
        typeof opts.autoplay === "boolean" ? opts.autoplay : !reduced;
      const finalSpeed =
        typeof opts.speed === "number" ? opts.speed : undefined;

      setLoop(finalLoop);
      setAutoplay(finalAutoplay);
      setSpeed(finalSpeed);
      onCloseRef.current = opts.onClose;

      if (opts.spinner) {
        setSpinner(true);
        setAnimationData(null);
        setVersion((v) => v + 1);
        setIsOpen(true);
        return true;
      }

      if (opts.data) {
        setSpinner(false);
        setAnimationData(opts.data);
        setVersion((v) => v + 1);
        setIsOpen(true);
        return true;
      }

      if (opts.url) {
        try {
          setSpinner(false);
          const res = await fetch(opts.url);
          if (!res.ok) throw new Error(`Failed to load animation: ${res.status}`);
          const json = (await res.json()) as object;
          setAnimationData(json);
          setVersion((v) => v + 1);
          setIsOpen(true);
          return true;
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error(e);
          setIsOpen(false);
          setAnimationData(null);
          return false;
        }
      }

      // If neither provided, no-op
      return false;
    },
    [getPrefersReducedMotion]
  );

  const value = React.useMemo(
    () => ({ isOpen, animationData, spinner, loop, autoplay, speed, version, open, close, closeWith }),
    [isOpen, animationData, spinner, loop, autoplay, speed, version, open, close, closeWith]
  );

  return (
    <LottieOverlayContext.Provider value={value}>
      {children}
    </LottieOverlayContext.Provider>
  );
}
