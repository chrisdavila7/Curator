"use client";

import * as React from "react";
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
  return (
    <span role="status" aria-live="polite" className={cn("inline-flex items-center justify-center", className)}>
      <span
        className={cn(
          "inline-block animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground",
          sizeClasses[size]
        )}
        aria-hidden="true"
      />
      <span className="sr-only">{ariaLabel ?? "Loading…"}</span>
    </span>
  );
}
