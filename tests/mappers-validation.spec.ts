import { describe, it, expect } from "vitest";
import { parseInventoryItem } from "@/lib/validation/inventory";
import {
  mapGraphListItemToInventory,
  FIELD_MAP,
  type GraphListItem,
} from "@/lib/mappers/inventory";

describe("Validation + Mapping", () => {
  describe("parseInventoryItem", () => {
    it("normalizes status, trims strings, normalizes dates, sanitizes assetImage", () => {
      const raw = {
        asset: "42", // coerce to number
        userLocation: "  HQ – IT Closet  ",
        status: "Ready to Deploy", // -> ready_to_deploy
        serial: "  500001 ",
        model: "  Dell OptiPlex 7090 ",
        assetImage: "javascript:alert(1)", // sanitized to ""
        notes: "  Imaged with baseline build ",
        modified: "2025-08-20T15:45:12.000Z", // -> 2025-08-20
        modifiedBy: "  Alex Rivera ",
        created: "2025-07-20",
        createdBy: " IT Intake ",
      };
      const item = parseInventoryItem(raw);
      expect(item).toEqual({
        asset: 42,
        userLocation: "HQ – IT Closet",
        status: "ready_to_deploy",
        serial: "500001",
        model: "Dell OptiPlex 7090",
        assetImage: "",
        notes: "Imaged with baseline build",
        modified: "2025-08-20",
        modifiedBy: "Alex Rivera",
        created: "2025-07-20",
        createdBy: "IT Intake",
      });
    });

    it("rejects invalid status", () => {
      const bad = {
        asset: 1,
        userLocation: "x",
        status: "unknown",
        serial: "s",
        model: "m",
        assetImage: "/ok.svg",
        notes: "",
        modified: "2025-01-01",
        modifiedBy: "u",
        created: "2025-01-01",
        createdBy: "v",
      };
      expect(() => parseInventoryItem(bad)).toThrow(/invalid status/i);
    });

    it("rejects invalid dates", () => {
      const bad = {
        asset: 1,
        userLocation: "x",
        status: "deployed",
        serial: "s",
        model: "m",
        assetImage: "/ok.svg",
        notes: "",
        modified: "not-a-date",
        modifiedBy: "u",
        created: "2025-01-01",
        createdBy: "v",
      };
      expect(() => parseInventoryItem(bad)).toThrow(/invalid date/i);
    });

    it("requires serial string (no coercion here)", () => {
      const bad = {
        asset: 1,
        userLocation: "x",
        status: "deployed",
        // serial numeric -> should fail (mapper handles coercion, validator expects string)
        serial: 12345 as unknown as string,
        model: "m",
        assetImage: "/ok.svg",
        notes: "",
        modified: "2025-01-01",
        modifiedBy: "u",
        created: "2025-01-01",
        createdBy: "v",
      };
      expect(() => parseInventoryItem(bad)).toThrow(/Expected string, received number/i);
    });
  });

  describe("mapGraphListItemToInventory", () => {
    const sys: GraphListItem = {
      id: "70001",
      createdDateTime: "2025-07-20T00:00:00.000Z",
      lastModifiedDateTime: "2025-08-20T12:34:56.000Z",
      createdBy: { user: { displayName: "System Creator" } },
      lastModifiedBy: { user: { displayName: "Editor User" } },
    };

    it("maps fields with fallbacks to system timestamps and actors", () => {
      const fields: Record<string, unknown> = {
        [FIELD_MAP.asset]: 70001,
        [FIELD_MAP.userLocation]: "HQ – Staging",
        [FIELD_MAP.status]: "Deployed",
        [FIELD_MAP.serial]: "50070001",
        [FIELD_MAP.model]: "Lenovo T14",
        [FIELD_MAP.assetImage]: "/globe.svg",
        [FIELD_MAP.notes]: "Docked at desk",
        // intentionally omit Modified/Created and actors to trigger fallbacks
      };

      const item = mapGraphListItemToInventory(fields, sys);
      expect(item.asset).toBe(70001);
      expect(item.userLocation).toBe("HQ – Staging");
      expect(item.status).toBe("deployed");
      expect(item.serial).toBe("50070001");
      expect(item.model).toBe("Lenovo T14");
      expect(item.assetImage).toBe("/globe.svg");
      expect(item.notes).toBe("Docked at desk");
      // Fallbacks
      expect(item.modified).toBe("2025-08-20");
      expect(item.modifiedBy).toBe("Editor User");
      expect(item.created).toBe("2025-07-20");
      expect(item.createdBy).toBe("System Creator");
    });

    it("coerces numeric serial to string and sanitizes bad assetImage", () => {
      const fields: Record<string, unknown> = {
        [FIELD_MAP.asset]: "70002",
        [FIELD_MAP.userLocation]: "Remote – Alice",
        [FIELD_MAP.status]: "ready to deploy",
        [FIELD_MAP.serial]: 555123, // <- numeric
        [FIELD_MAP.model]: "MacBook Pro",
        [FIELD_MAP.assetImage]: "javascript:alert(1)", // sanitized to ""
        [FIELD_MAP.notes]: "N/A",
        [FIELD_MAP.modified]: "2025-08-19T01:23:45.000Z",
        [FIELD_MAP.modifiedBy]: "Ops",
        [FIELD_MAP.created]: "2025-08-01T00:00:00.000Z",
        [FIELD_MAP.createdBy]: "Intake",
      };

      const item = mapGraphListItemToInventory(fields, sys);
      expect(item.asset).toBe(70002);
      expect(item.serial).toBe("555123");
      expect(item.assetImage).toBe("");
      expect(item.status).toBe("ready_to_deploy");
      expect(item.modified).toBe("2025-08-19");
      expect(item.created).toBe("2025-08-01");
    });

    it("falls back asset to numeric sys.id when Title missing", () => {
      const fields: Record<string, unknown> = {
        // Title missing
        [FIELD_MAP.userLocation]: "HQ – IT",
        [FIELD_MAP.status]: "Retired",
        [FIELD_MAP.serial]: "X",
        [FIELD_MAP.model]: "Monitor",
        [FIELD_MAP.assetImage]: "/img.svg",
        [FIELD_MAP.notes]: "",
        [FIELD_MAP.modified]: "2025-08-18T00:00:00.000Z",
        [FIELD_MAP.modifiedBy]: "Ops",
        [FIELD_MAP.created]: "2025-08-01T00:00:00.000Z",
        [FIELD_MAP.createdBy]: "Intake",
      };

      const item = mapGraphListItemToInventory(fields, sys);
      expect(item.asset).toBe(70001); // from sys.id
      expect(item.status).toBe("retired");
    });
  });
});
