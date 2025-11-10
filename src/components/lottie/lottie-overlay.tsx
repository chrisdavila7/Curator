"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import LottiePlayer, { LottiePlayerRef } from "@/components/lottie/lottie-player";
import { useLottieOverlay } from "@/components/lottie/overlay-provider";
import { Spinner } from "@/components/ui/spinner";

function useEscape(handler: () => void, active: boolean) {
  React.useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handler();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handler, active]);
}

export default function LottieOverlay() {
  const { isOpen, animationData, spinner, loop, autoplay, speed, close, closeWith, version } = useLottieOverlay();
  const ref = React.useRef<LottiePlayerRef>(null);
  const [mounted, setMounted] = React.useState(false);
  const [visible, setVisible] = React.useState(false);

  useEscape(close, isOpen);

  // Stop on unmount/close for cleanup
  React.useEffect(() => {
    if (!isOpen) {
      ref.current?.stop?.();
    }
  }, [isOpen]);

  // Start playback exactly when overlay becomes visible (sync with fade-in)
  React.useEffect(() => {
    if (isOpen && visible && animationData && ref.current?.play) {
      try {
        ref.current.stop?.();
        ref.current.play?.();
      } catch {
        // no-op
      }
    }
  }, [isOpen, visible, animationData]);

  // Mount/unmount with fade/scale transitions for ease-in/out
  React.useEffect(() => {
    if (isOpen && (animationData || spinner)) {
      setMounted(true);
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    } else if (mounted) {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 500);
      return () => clearTimeout(t);
    }
  }, [isOpen, animationData, spinner, mounted]);


  if (!mounted) return null;

  const overlay = (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center"
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/30 ${visible ? "backdrop-blur-sm opacity-100" : "backdrop-blur-0 opacity-0"} transition-all duration-500 ease-in-out`}
        onClick={close}
        aria-hidden="true"
      />
      {/* Panel */}
      <div
        className={`relative z-[101] mx-4 w-[min(90vw,1000px)] h-[min(80vh,700px)] bg-transparent outline-none transform transition-transform duration-500 ease-in-out ${visible ? "scale-100" : "scale-95"}`}
      >
        <div className="absolute inset-0 grid place-items-center p-4">
          <div className="h-full w-full">
            {animationData ? (
              <LottiePlayer
                key={version}
                ref={ref}
                animationData={animationData}
                loop={loop}
                speed={typeof speed === "number" ? speed : 1.2}
                autoplay={false}
                onComplete={() => (closeWith ? closeWith("complete") : close())}
                className="h-full w-full"
              />
            ) : spinner ? (
              <div className="h-full w-full grid place-items-center">
                <Spinner size="lg" aria-label="Loading" />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(overlay, document.body);
  }
  return overlay;
}
