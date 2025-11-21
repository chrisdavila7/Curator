import type { InventoryStatus } from "@/types/inventory";

// Central palette used by Create overlay (ButtonGroup) and StatusBadge.
// Keep these EXACT to ensure visual parity across the app.
export type ColorKey = "ready" | "deployed" | "retired";

export const STATUS_COLORS: Record<ColorKey, { bg: string; text: string; border: string }> = {
  // Ready to Deploy
  ready: { bg: "#252545", text: "#D7DAFF",},
  // Deployed
  deployed: { bg: "#390d05", text: "#ff9e86ff" },
  // Retired
  retired: { bg: "#EF4444", text: "#EDEDED" },
};

export const statusToColorKey = (status: InventoryStatus): ColorKey => {
  switch (status) {
    case "ready_to_deploy":
      return "ready";
    case "deployed":
      return "deployed";
    case "retired":
      return "retired";
    default:
      return "ready";
  }
};

export const statusColorsFor = (
  status: InventoryStatus
): { bg: string; text: string; border: string } => {
  const key = statusToColorKey(status);
  return STATUS_COLORS[key];
};
