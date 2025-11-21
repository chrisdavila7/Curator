import { describe, it, expect } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { DataTable } from "@/components/data-table/data-table";
import { inventoryColumns } from "@/components/data-table/columns";
import type { InventoryItem } from "@/types/inventory";
import { STATUS_COLORS } from "@/lib/status-colors";

// Convert a hex color to the rgb(...) string that the browser serializes inline styles to.
function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const bigint = parseInt(h, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgb(${r}, ${g}, ${b})`;
}

const makeItem = (overrides: Partial<InventoryItem> = {}): InventoryItem => ({
  asset: 100,
  model: "Test Model",
  serial: "SN123",
  userLocation: "Inventory",
  status: "ready_to_deploy",
  assetImage: "https://example.com/image.png",
  notes: "",
  modified: "2024-01-02",
  modifiedBy: "tester",
  created: "2024-01-01",
  createdBy: "tester",
  ...overrides,
});

const EXPECTED: Record<"ready" | "deployed" | "retired", { bg: string; text: string }> = {
  ready: { bg: "#2F2F39", text: "#000000" },
  deployed: { bg: "#FA6E4B", text: "#FF5329" },
  retired: STATUS_COLORS.retired,
};

describe("inventoryColumns status cell", () => {
  it("renders StatusBadge with the Create overlay palette for each status", async () => {
    const items: InventoryItem[] = [
      makeItem({ status: "ready_to_deploy", asset: 1 }),
      makeItem({ status: "deployed", asset: 2 }),
      makeItem({ status: "retired", asset: 3 }),
    ];

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <div>
          <DataTable columns={inventoryColumns} data={items} pageSize={10} showPagination={false} />
        </div>
      );
      await Promise.resolve();
    });

    const badges = Array.from(container.querySelectorAll('[data-slot="status-badge"]')) as HTMLSpanElement[];
    expect(badges.length).toBe(3);

    // Use computed styles to compare, since browsers normalize to rgb(...)
    const cs0 = window.getComputedStyle(badges[0]);
    expect(cs0.backgroundColor.replace(/\s+/g, "")).toBe(
      (EXPECTED.ready.bg.startsWith("#") ? hexToRgb(EXPECTED.ready.bg) : EXPECTED.ready.bg).replace(/\s+/g, "")
    );
    expect(cs0.color.replace(/\s+/g, "")).toBe(hexToRgb(EXPECTED.ready.text).replace(/\s+/g, ""));
    expect(badges[0].className).toContain("rounded-full");

    const cs1 = window.getComputedStyle(badges[1]);
    expect(cs1.backgroundColor.replace(/\s+/g, "")).toBe(
      (EXPECTED.deployed.bg.startsWith("#") ? hexToRgb(EXPECTED.deployed.bg) : EXPECTED.deployed.bg).replace(/\s+/g, "")
    );
    expect(cs1.color.replace(/\s+/g, "")).toBe(hexToRgb(EXPECTED.deployed.text).replace(/\s+/g, ""));
    expect(badges[1].className).toContain("rounded-full");

    const cs2 = window.getComputedStyle(badges[2]);
    expect(cs2.backgroundColor.replace(/\s+/g, "")).toBe(
      (EXPECTED.retired.bg.startsWith("#") ? hexToRgb(EXPECTED.retired.bg) : EXPECTED.retired.bg).replace(/\s+/g, "")
    );
    expect(cs2.color.replace(/\s+/g, "")).toBe(hexToRgb(EXPECTED.retired.text).replace(/\s+/g, ""));
    expect(badges[2].className).toContain("rounded-full");
  });
});
