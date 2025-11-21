"use client";

import * as React from "react";
import LottiePlayer from "@/components/lottie/lottie-player";
import { Spinner } from "@/components/ui/spinner";
import { LOADING_ANIMATION_PATH } from "@/components/loading/loading-constants";
import { cn } from "@/lib/utils";

export type LottieInlineLoaderProps = {
  label?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClasses: Record<NonNullable<LottieInlineLoaderProps["size"]>, string> = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
};

export function LottieInlineLoader({
  label = "Loading…",
  size = "sm",
  className,
}: LottieInlineLoaderProps) {
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

  const resolvedSize = size ?? "sm";

  return (
    <div className={cn("inline-flex items-center gap-2 text-muted-foreground", className)} aria-live="polite">
      <div className={cn("flex items-center justify-center", sizeClasses[resolvedSize])}>
        {animationData ? (
          <LottiePlayer animationData={animationData} loop autoplay className="h-full w-full" />
        ) : (
          <Spinner size={resolvedSize} />
        )}
      </div>
      {label ? <span>{label}</span> : null}
    </div>
  );
}
