"use client";

import * as React from "react";
import LottiePlayer from "@/components/lottie/lottie-player";
import { LOADING_ANIMATION_PATH } from "@/components/loading/loading-constants";
import { cn } from "@/lib/utils";

type SpinnerSize = "sm" | "md" | "lg";

export type SpinnerProps = {
  size?: SpinnerSize;
  className?: string;
  "aria-label"?: string;
};

const sizeClasses: Record<SpinnerSize, string> = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
};

export function Spinner({ size = "md", className, "aria-label": ariaLabel }: SpinnerProps) {
  const [animationData, setAnimationData] = React.useState<object | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(LOADING_ANIMATION_PATH, { cache: "force-cache" });
        if (!res.ok) return;
        const json = (await res.json()) as object;
        if (!cancelled) {
          setAnimationData(json);
        }
      } catch {
        if (!cancelled) {
          setAnimationData(null);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const label = ariaLabel ?? "Loading…";

  return (
    <span role="status" aria-live="polite" className={cn("inline-flex items-center justify-center", className)}>
      {animationData ? (
        <LottiePlayer
          animationData={animationData}
          loop
          autoplay
          className={sizeClasses[size]}
          ariaLabel={label}
        />
      ) : (
        <span
          className={cn(
            "inline-block animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground",
            sizeClasses[size]
          )}
          aria-hidden="true"
        />
      )}
      <span className="sr-only">{label}</span>
    </span>
  );
}
