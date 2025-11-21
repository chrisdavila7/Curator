"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { STATUS_COLORS, type ColorKey } from "@/lib/status-colors";

type ButtonGroupOption = {
  label: string;
  value: string;
  color: ColorKey;
  testId?: string;
};

type ButtonGroupProps = {
  value: string;
  onChange: (value: string) => void;
  options: ButtonGroupOption[];
  ariaLabel?: string;
  className?: string;
};

/**
 * Accessible radio-style button group built with shadcn/ui Button
 * - Uses role="radiogroup" and role="radio" for a11y parity with radios.
 * - ArrowLeft/ArrowRight switch the selected option.
 * - Hover styles rely on default Button variant. Selected style is applied inline so it remains stable on hover.
 */
const COLOR_STYLES = STATUS_COLORS;

const COLOR_INTERACTIONS: Record<ColorKey, { hoverRing: string; focusRing: string }> = {
  ready: { hoverRing: "hover:ring-indigo-950/60", focusRing: "focus-visible:ring-indigo-100" },
  deployed: { hoverRing: "hover:ring-orange-500/60", focusRing: "focus-visible:ring-orange-600" },
  retired: { hoverRing: "hover:ring-red-500/60", focusRing: "focus-visible:ring-red-600" },
};

export function ButtonGroup({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: ButtonGroupProps) {
  const baseId = React.useId();

  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  );

  function focusIndex(idx: number) {
    const el = document.getElementById(`${baseId}-${idx}`) as HTMLButtonElement | null;
    if (el) el.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const dir = e.key === "ArrowRight" ? 1 : -1;
    const len = options.length;
    const current = selectedIndex >= 0 ? selectedIndex : 0;
    const next = (current + dir + len) % len;
    onChange(options[next].value);
    // Move focus to the newly selected button for roving tabindex UX
    requestAnimationFrame(() => focusIndex(next));
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("inline-flex items-center gap-2", className)}
      onKeyDown={handleKeyDown}
    >
      {options.map((opt, i) => {
        const selected = value === opt.value;
        const colors = COLOR_STYLES[opt.color];
        const interactions = COLOR_INTERACTIONS[opt.color];
        return (
          <Button
            key={opt.value}
            id={`${baseId}-${i}`}
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            variant="outline"
            size="sm"
            data-selected={selected ? "true" : "false"}
            data-testid={opt.testId}
            className={cn(
              "rounded-full px-4 py-1.5 border",
              "text-sm",
              "transition-all duration-200 ease-out hover:bg-accent/80 hover:shadow-sm hover:ring-1 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
              interactions.hoverRing,
              interactions.focusRing,
              !selected && "bg-background",
              selected && "border-transparent"
            )}
            // Inline style ensures selected color is stable and not overridden by hover classes
            style={selected ? { backgroundColor: colors.bg, color: colors.text } : undefined}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </Button>
        );
      })}
    </div>
  );
}

export type { ButtonGroupProps, ButtonGroupOption, ColorKey };
