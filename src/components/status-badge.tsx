import * as React from "react";
import { cn } from "@/lib/utils";
import { statusLabel } from "@/lib/status-label";
import type { InventoryStatus } from "@/types/inventory";
import { statusColorsFor } from "@/lib/status-colors";

type StatusBadgeProps = React.ComponentProps<"span"> & {
  status: InventoryStatus;
  /**
   * Optional override for the text label.
   * If omitted, label is derived via statusLabel(status).
   */
  label?: string;
};

/**
 * StatusBadge
 * - Pill-style tag matching Create overlay palette (same bg/text colors)
 * - Defaults to label from statusLabel(status)
 * - Allows children/label override to support highlighted text in Assets table
 */
export function StatusBadge({
  status,
  label,
  className,
  style,
  children,
  ...props
}: StatusBadgeProps) {
  const colors = statusColorsFor(status);
  const text = label ?? statusLabel(status);

  return (
    <span
      data-slot="status-badge"
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        className
      )}
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
        ...(status === "ready_to_deploy"
          ? { border: colors.border }
          : {}),
        ...style,
      }}
      {...props}
    >
      {children ?? text}
    </span>
  );
}
