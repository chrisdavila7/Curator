"use client";

import * as React from "react";
import { useGlobalLoading } from "@/components/loading/loading-provider";
import { cn } from "@/lib/utils";

type TopLoaderProps = {
  className?: string;
  height?: number; // px
};

export function TopLoader({ className, height = 3 }: TopLoaderProps) {
  const { visible } = useGlobalLoading();

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className={cn("fixed left-0 top-0 z-50 w-full overflow-hidden", className)}
      style={{ height }}
    >
      <div className="h-full w-[30%] bg-primary animate-top-loader rounded-r-full" />
    </div>
  );
}
