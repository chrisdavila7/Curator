"use client";

import * as React from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

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
            "hover:bg-accent/80 hover:shadow-sm hover:ring-1 hover:ring-sky-300/40",
            "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-sky-400",
            "data-[state=inactive]:text-foreground data-[state=inactive]:opacity-100"
          )}
          style={!isCheckout ? { backgroundColor: "rgba(0,166,244,0.3)", color: "#00A6F4" } : undefined}
        >
          Check In
        </TabsTrigger>
        <TabsTrigger
          value="out"
          className={cn(
            "relative rounded-full px-3 py-1.5 text-sm font-medium outline-none",
            "transition-all duration-200 ease-out",
            "hover:bg-accent/80 hover:shadow-sm hover:ring-1 hover:ring-emerald-300/40",
            "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-400",
            "data-[state=inactive]:text-foreground data-[state=inactive]:opacity-100"
          )}
          style={isCheckout ? { backgroundColor: "rgba(0,188,125,0.3)", color: "#00BC7D" } : undefined}
        >
          Check Out
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
