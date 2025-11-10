import type { InventoryStatus } from "@/types/inventory";

export type StatusLabel = "Ready to Deploy" | "Deployed" | "Retired";

export function statusLabel(s: InventoryStatus): StatusLabel {
  switch (s) {
    case "ready_to_deploy":
      return "Ready to Deploy";
    case "deployed":
      return "Deployed";
    case "retired":
      return "Retired";
    default:
      return "Ready to Deploy";
  }
}
