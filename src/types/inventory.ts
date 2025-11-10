// Centralized domain types for Inventory

export type InventoryStatus = "ready_to_deploy" | "deployed" | "retired";

export type InventoryItem = {
  asset: number;
  userLocation: string;
  status: InventoryStatus;
  serial: string;
  model: string;
  assetImage: string; // path or URL
  notes: string;
  modified: string; // ISO date string (YYYY-MM-DD or full ISO)
  modifiedBy: string;
  created: string; // ISO date string (YYYY-MM-DD or full ISO)
  createdBy: string;
};

export type DeployedWindow = "today" | "week" | "month";
