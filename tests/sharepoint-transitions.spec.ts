import { describe, it, expect } from "vitest";
import { findDeployedTransitionTimestamp } from "@/lib/graph/sharepoint";

// Helper to build version entries with specific status and timestamp.
// FIELD_MAP.status maps to "field_2" per implementation; we use that key directly.
type VersionStub = { lastModifiedDateTime: string; fields: { field_2: string } };
function v(ts: string, status: string): VersionStub {
  return {
    lastModifiedDateTime: ts,
    fields: { field_2: status },
  };
}

describe("findDeployedTransitionTimestamp", () => {
  it("returns the timestamp where status transitions to deployed (newest first order)", () => {
    const versions = [
      v("2025-08-15T10:00:00.000Z", "Deployed"),
      v("2025-08-14T09:00:00.000Z", "Ready to Deploy"),
      v("2025-08-13T08:00:00.000Z", "Ready to Deploy"),
    ];
    const ts = findDeployedTransitionTimestamp(versions);
    expect(ts).toBe("2025-08-15T10:00:00.000Z");
  });

  it("falls back to newest timestamp when all known versions are deployed", () => {
    const versions = [
      v("2025-08-15T10:00:00.000Z", "Deployed"),
      v("2025-08-14T09:00:00.000Z", "Deployed"),
      v("2025-08-13T08:00:00.000Z", "Deployed"),
    ];
    const ts = findDeployedTransitionTimestamp(versions);
    expect(ts).toBe("2025-08-15T10:00:00.000Z");
  });

  it("returns undefined when there is no deployed status in the scanned versions", () => {
    const versions = [
      v("2025-08-15T10:00:00.000Z", "Ready to Deploy"),
      v("2025-08-14T09:00:00.000Z", "Retired"),
      v("2025-08-13T08:00:00.000Z", "Ready_to_Deploy"),
    ];
    const ts = findDeployedTransitionTimestamp(versions);
    expect(ts).toBeUndefined();
  });

  it("handles mixed casing and delimiters for status values", () => {
    const versions = [
      v("2025-08-15T10:00:00.000Z", "DEPLOYED"),
      v("2025-08-14T09:00:00.000Z", "ready-to-deploy"),
    ];
    const ts = findDeployedTransitionTimestamp(versions);
    expect(ts).toBe("2025-08-15T10:00:00.000Z");
  });
});
