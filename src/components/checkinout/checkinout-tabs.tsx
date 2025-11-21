"use client";

import * as React from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { STATUS_COLORS } from "@/lib/status-colors";

type Props = {
  isCheckout: boolean;
  onChange: (next: boolean) => void;
  className?: string;
};

export default function CheckInOutTabs({ isCheckout, onChange, className }: Props) {
  return (
    <Tabs
      value={isCheckout ? "out" : "in"}
      onValueChange={(v) => onChange(v === "out")}
      className={className}
    >
      <TabsList className={cn("rounded-full p-1 bg-muted")}>
        <TabsTrigger
          value="in"
          className={cn(
            "relative rounded-full px-3 py-1.5 text-sm font-medium outline-none",
            "transition-all duration-200 ease-out",
            "hover:bg-accent/80 hover:shadow-sm hover:ring-1 hover:ring-indigo-950/20",
            "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-100",
            "data-[state=inactive]:text-foreground data-[state=inactive]:opacity-100"
          )}
          style={!isCheckout ? { backgroundColor: STATUS_COLORS.ready.bg, color: STATUS_COLORS.ready.text } : undefined}
        >
          Check In
        </TabsTrigger>
        <TabsTrigger
          value="out"
          className={cn(
            "relative rounded-full px-3 py-1.5 text-sm font-medium outline-none",
            "transition-all duration-200 ease-out",
            "hover:bg-accent/80 hover:shadow-sm hover:ring-1 hover:ring-orange-500/20",
            "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-400",
            "data-[state=inactive]:text-foreground data-[state=inactive]:opacity-100"
          )}
          style={isCheckout ? { backgroundColor: STATUS_COLORS.deployed.bg, color: STATUS_COLORS.deployed.text } : undefined}
        >
          Check Out
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
