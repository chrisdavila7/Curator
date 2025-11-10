"use client";

import * as React from "react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export type InlineLoaderProps = {
  label?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function InlineLoader({ label = "Loading…", size = "sm", className }: InlineLoaderProps) {
  return (
    <div className={cn("inline-flex items-center gap-2 text-muted-foreground", className)} aria-live="polite">
      <Spinner size={size} />
      {label ? <span>{label}</span> : null}
    </div>
  );
}
