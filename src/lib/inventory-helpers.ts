import { InventoryItem } from "@/types/inventory";

/**
 * Returns items that are ready to deploy.
 */
export function readyToDeploy(items: InventoryItem[]): InventoryItem[] {
  return items.filter((i) => i.status === "ready_to_deploy");
}

/**
 * Returns items modified within the last `days` days (default 14).
 */
export function recentModifications(items: InventoryItem[], days = 14): InventoryItem[] {
  const now = Date.now();
  return items.filter((i) => {
    const mod = new Date(i.modified).getTime();
    if (Number.isNaN(mod)) return false;
    const diffDays = (now - mod) / (1000 * 60 * 60 * 24);
    return diffDays <= days;
  });
}

/**
 * Returns deployed assets sorted by most recently modified first.
 */
export function deployedAssets(items: InventoryItem[]): InventoryItem[] {
  return [...items]
    .filter((i) => i.status === "deployed")
    .sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
}
