"use client";

import * as React from "react";
import LottiePlayer from "@/components/lottie/lottie-player";
import { Spinner } from "@/components/ui/spinner";
import { LOADING_ANIMATION_PATH } from "@/components/loading/loading-constants";
import { cn } from "@/lib/utils";


export type LoadingOverlaySize = "sm" | "md" | "lg";

export type LoadingOverlayProps = {
  open: boolean;
  label?: string;
  size?: LoadingOverlaySize;
  className?: string;
};

const sizeClasses: Record<LoadingOverlaySize, string> = {
  sm: "h-16 w-16",
  md: "h-20 w-20",
  lg: "h-24 w-24",
};

function getContainerSize(size: LoadingOverlaySize): string {
  if (size === "sm") return "px-4 py-3";
  if (size === "lg") return "px-8 py-6";
  return "px-6 py-4";
}

export default function LoadingOverlay({
  open,
  label = "Loading…",
  size = "md",
  className,
}: LoadingOverlayProps) {
  const resolvedSize = size ?? "md";

  if (!open) return null;

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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-[120] flex items-center justify-center"
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
      <div
        className={cn(
          "relative z-[121] rounded-lg bg-background/90 shadow-lg flex flex-col items-center justify-center gap-3",
          getContainerSize(resolvedSize),
          className
        )}
      >
        <div className={cn("flex flex-col items-center justify-center gap-3")}
        >
          <div className={cn("flex items-center justify-center", sizeClasses[resolvedSize])}>
            {animationData ? (
              <LottiePlayer
                animationData={animationData}
                loop
                autoplay
                className="h-full w-full"
                ariaLabel={label}
              />
            ) : (
              <Spinner aria-label={label} />
            )}
          </div>
          {label ? (
            <p className="text-sm text-muted-foreground text-center max-w-xs">{label}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
