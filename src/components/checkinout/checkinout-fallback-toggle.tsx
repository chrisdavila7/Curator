"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  style?: React.CSSProperties;
  initialIsCheckout?: boolean; // default true
  onModeChange?: (isCheckout: boolean) => void;
};

/**
 * Failsafe segmented toggle shown only if Lottie toggle is unavailable.
 * - Left: "Check In" (sky-500)
 * - Right: "Check Out" (emerald-600)
 * - Matches Lottie container footprint (120x120) and behavior: default to Check Out, emit only on user interaction.
 */
export default function CheckInOutFallbackToggle({
  className,
  style,
  initialIsCheckout = true,
  onModeChange,
}: Props) {
  const [isCheckout, setIsCheckout] = React.useState<boolean>(initialIsCheckout);

  const setMode = React.useCallback(
    (next: boolean) => {
      setIsCheckout(next);
      onModeChange?.(next);
    },
    [onModeChange]
  );

  // Keyboard support: Left selects Check In, Right selects Check Out, Space/Enter handled by button by default
  const onKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setMode(false);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setMode(true);
    }
  };

  return (
    <div
      role="group"
      aria-label="Check In/Out mode toggle"
      tabIndex={0}
      onKeyDown={onKeyDown}
      className={cn(
        "rounded-md border bg-background/40 flex items-center justify-center",
        "transition-transform select-none opacity-100 scale-[1.15] origin-top",
        className
      )}
      style={style}
    >
      <div className="w-[120px]">
        <div
          className={cn(
            "w-full h-10 rounded-full border overflow-hidden grid grid-cols-2",
            "bg-background"
          )}
        >
          {/* Left: Check In (sky-500) */}
          <button
            type="button"
            aria-pressed={!isCheckout}
            aria-label="Set mode: Check In"
            className={cn(
              "text-sm font-medium px-3 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              !isCheckout
                ? "bg-sky-600 text-white"
                : "bg-transparent text-foreground hover:bg-accent",
              "border-r"
            )}
            onClick={() => setMode(false)}
          >
            Check In
          </button>

          {/* Right: Check Out (emerald-600) */}
          <button
            type="button"
            aria-pressed={isCheckout}
            aria-label="Set mode: Check Out"
            className={cn(
              "text-sm font-medium px-3 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isCheckout
                ? "bg-emerald-600 text-white"
                : "bg-transparent text-foreground hover:bg-accent"
            )}
            onClick={() => setMode(true)}
          >
            Check Out
          </button>
        </div>
      </div>
    </div>
  );
}
