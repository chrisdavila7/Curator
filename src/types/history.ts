export type HistoryField =
  | "asset"
  | "serial"
  | "model"
  | "userLocation"
  | "status"
  | "assetImage"
  | "notes";

export type HistoryChangeType = "changed" | "added" | "removed";

export type AssetHistoryEvent = {
  at: string; // ISO timestamp of the change (from Graph version's lastModifiedDateTime)
  by: string; // Display name of modifier (from Graph version's lastModifiedBy.user.displayName)
  field: HistoryField;
  changeType: HistoryChangeType;
  from?: string; // previous value (when changed/removed)
  to?: string; // new value (when changed/added)
};
