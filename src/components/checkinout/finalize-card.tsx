"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Boxes } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_COLORS } from "@/lib/status-colors";

type Props = {
  inCount?: number;
  outCount?: number;
  className?: string;
  onFinalize?: () => void;
  variant?: "sidebar" | "inline";
};

/**
 * Finalize side card (icons + counts + button).
 * - Icons are decorative (no function).
 * - Button labeled "Finalize" (function pending).
 */
export default function FinalizeCard({ inCount = 0, outCount = 0, className, onFinalize, variant = "sidebar" }: Props) {
  if (variant === "inline") {
    return (
      <div className={cn("w-full", className)}>
        <div className="flex items-center justify-center gap-6">
          <span
            className={cn("text-4xl font-semibold tabular-nums", inCount > 0 ? "" : "text-black")}
            style={inCount > 0 ? { color: STATUS_COLORS.ready.text } : undefined}
          >
            {inCount}
          </span>
          <Boxes className="size-14" aria-hidden="true" />
          <span
            className={cn("text-4xl font-semibold tabular-nums", outCount > 0 ? "" : "text-black")}
            style={outCount > 0 ? { color: STATUS_COLORS.deployed.text } : undefined}
          >
            {outCount}
          </span>
        </div>

        <div className="h-[1.5625rem]" />

        <Button type="button" className="w-full" disabled={inCount === 0 && outCount === 0} onClick={onFinalize}>Finalize</Button>
      </div>
    );
  }

  return (
    <Card className={cn("rounded-2xl shadow-md", className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-center gap-6">
          <span
            className={cn("text-4xl font-semibold tabular-nums", inCount > 0 ? "" : "text-black")}
            style={inCount > 0 ? { color: STATUS_COLORS.ready.text } : undefined}
          >
            {inCount}
          </span>
          <Boxes className="size-14" aria-hidden="true" />
          <span
            className={cn("text-4xl font-semibold tabular-nums", outCount > 0 ? "" : "text-black")}
            style={outCount > 0 ? { color: STATUS_COLORS.deployed.text } : undefined}
          >
            {outCount}
          </span>
        </div>

        <div className="h-[1.5625rem]" />

        <Button type="button" className="w-full" disabled={inCount === 0 && outCount === 0} onClick={onFinalize}>Finalize</Button>
      </CardContent>
    </Card>
  );
}
