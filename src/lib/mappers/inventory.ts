import type { InventoryItem } from "@/types/inventory";
import { parseInventoryItem } from "@/lib/validation/inventory";

/**
 * SharePoint internal field mapping -> our domain keys.
 * Provided by user:
 *  - Title = Title
 *  - User/Location = field_0
 *  - Asset Status = field_2
 *  - Asset Serial = field_3
 *  - Asset Model = field_4
 *  - Notes = field_5
 *  - Asset Image = AssetImage
 *  - Modified = Modified
 *  - Created = Created
 *  - Created By = Author
 *  - Modified By = Editor
 */
export type DomainField =
  | "asset"
  | "userLocation"
  | "status"
  | "serial"
  | "model"
  | "assetImage"
  | "notes"
  | "modified"
  | "modifiedBy"
  | "created"
  | "createdBy";

export const FIELD_MAP: Record<DomainField, string> = {
  asset: "Title",
  userLocation: "field_0",
  status: "field_2",
  serial: "field_3",
  model: "field_4",
  assetImage: "AssetImage",
  notes: "field_5",
  modified: "Modified",
  modifiedBy: "Editor",
  created: "Created",
  createdBy: "Author",
};

// Use SP internal names for $expand=fields($select=...)
export const SP_FIELDS_SELECT = Array.from(new Set(Object.values(FIELD_MAP))).join(",");

// Minimal system fields shape we care about from Graph list item
export type GraphListItem = {
  id: string;
  createdDateTime?: string;
  lastModifiedDateTime?: string;
  createdBy?: { user?: { displayName?: string | null } | null } | null;
  lastModifiedBy?: { user?: { displayName?: string | null } | null } | null;
};

/**
 * Maps a Graph list item (fields + system metadata) to an InventoryItem,
 * applying coercions and defaults via parseInventoryItem (zod).
 */
export function mapGraphListItemToInventory(
  fields: Record<string, unknown> | undefined,
  sys: GraphListItem
): InventoryItem {
  const f = fields ?? {};
  const pick = (k: DomainField) => f[FIELD_MAP[k] as keyof typeof f];

  const raw = {
    asset: pick("asset") ?? (sys.id ? Number.parseInt(sys.id, 10) : undefined),
    userLocation: pick("userLocation") ?? "",
    status: pick("status") ?? "",
    serial: (() => {
      const v = pick("serial");
      if (v === "" || v === undefined || v === null) return undefined;
      return String(v);
    })(),
    model: pick("model") ?? "",
    assetImage: pick("assetImage") ?? "",
    notes: pick("notes") ?? "",
    // If custom columns are absent, fall back to system timestamps and actors
    modified: (pick("modified") as unknown) ?? sys.lastModifiedDateTime ?? "",
    modifiedBy:
      (pick("modifiedBy") as unknown as string | undefined) ??
      (sys.lastModifiedBy?.user?.displayName ?? ""),
    created: (pick("created") as unknown) ?? sys.createdDateTime ?? "",
    createdBy:
      (pick("createdBy") as unknown as string | undefined) ??
      (sys.createdBy?.user?.displayName ?? ""),
  };

  return parseInventoryItem(raw);
}
