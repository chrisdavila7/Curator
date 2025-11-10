"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Props = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
};

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  className,
  id,
  ...aria
}: Props) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      data-state={checked ? "checked" : "unchecked"}
      disabled={disabled}
      onClick={() => !disabled && onCheckedChange(!checked)}
      className={cn(
        "inline-flex h-5 w-10 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-[3px]",
        checked ? "bg-emerald-500 border-emerald-500 focus-visible:ring-emerald-400" : "bg-sky-500 border-sky-500 focus-visible:ring-sky-400",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
        className
      )}
      {...aria}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-4 w-4 rounded-full bg-background shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-1"
        )}
      />
    </button>
  );
}

export default Switch;
