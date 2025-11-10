import type { AssetHistoryEvent, HistoryField } from "@/types/history";
import type { GraphListItemVersion } from "@/lib/graph/sharepoint";
import { FIELD_MAP, type DomainField } from "@/lib/mappers/inventory";

// Fields we consider for history rows (exclude set/system fields)
const DOMAIN_FIELDS: HistoryField[] = [
  "asset",
  "serial",
  "model",
  "userLocation",
  "status",
  "assetImage",
  "notes",
];

// Normalize to string for display and comparison
function toStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  try {
    return String(v);
  } catch {
    return "";
  }
}

function isEmpty(v: unknown): boolean {
  const s = toStr(v).trim();
  return s.length === 0;
}

// Map domain field to its SharePoint internal field name via FIELD_MAP
function getFieldKey(field: HistoryField): string {
  // HistoryField is a subset of DomainField
  return FIELD_MAP[field as DomainField];
}

export function computeAssetHistoryEvents(
  versionsNewestFirst: GraphListItemVersion[]
): AssetHistoryEvent[] {
  const events: AssetHistoryEvent[] = [];
  if (!Array.isArray(versionsNewestFirst) || versionsNewestFirst.length === 0) {
    return events;
  }

  // Iterate adjacent pairs: cur(newer) vs prev(older)
  for (let i = 0; i < versionsNewestFirst.length - 1; i++) {
    const cur = versionsNewestFirst[i];
    const prev = versionsNewestFirst[i + 1];
    const at = cur.lastModifiedDateTime || "";
    const by = cur.lastModifiedBy?.user?.displayName || "";

    const curFields = (cur.fields ?? {}) as Record<string, unknown>;
    const prevFields = (prev?.fields ?? {}) as Record<string, unknown>;

    for (const field of DOMAIN_FIELDS) {
      const key = getFieldKey(field);
      const curVal = curFields[key];
      const prevVal = prevFields[key];

      const curEmpty = isEmpty(curVal);
      const prevEmpty = isEmpty(prevVal);

      if (!prevEmpty && !curEmpty) {
        const sPrev = toStr(prevVal);
        const sCur = toStr(curVal);
        if (sPrev !== sCur) {
          events.push({
            at,
            by,
            field,
            changeType: "changed",
            from: sPrev,
            to: sCur,
          });
        }
      } else if (prevEmpty && !curEmpty) {
        events.push({
          at,
          by,
          field,
          changeType: "added",
          to: toStr(curVal),
        });
      } else if (!prevEmpty && curEmpty) {
        events.push({
          at,
          by,
          field,
          changeType: "removed",
          from: toStr(prevVal),
        });
      }
      // else both empty: no event
    }
  }

  // Sort chronological ascending (oldest at top)
  events.sort((a, b) => {
    const ta = new Date(a.at).getTime();
    const tb = new Date(b.at).getTime();
    return ta - tb;
  });

  return events;
}
