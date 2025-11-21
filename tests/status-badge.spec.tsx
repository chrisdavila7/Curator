import { describe, it, expect } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";

import { StatusBadge } from "@/components/status-badge";
import { STATUS_COLORS } from "@/lib/status-colors";
import { statusLabel } from "@/lib/status-label";
import type { InventoryStatus } from "@/types/inventory";

type Case = {
  status: InventoryStatus;
  colorKey: "ready" | "deployed" | "retired";
};

const cases: Case[] = [
  { status: "ready_to_deploy", colorKey: "ready" },
  { status: "deployed", colorKey: "deployed" },
  { status: "retired", colorKey: "retired" },
];

const EXPECTED: Record<"ready" | "deployed" | "retired", { bg: string; text: string }> = {
  ready: { bg: "#2F2F39", text: "#000000" },
  deployed: { bg: "#FA6E4B", text: "#FF5329" },
  retired: STATUS_COLORS.retired,
};

// Convert a hex color to the rgb(...) string that the browser serializes inline styles to.
function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const bigint = parseInt(h, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgb(${r}, ${g}, ${b})`;
}

describe("StatusBadge", () => {
  it("renders correct label and inline colors for each status", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <div>
          {cases.map((c) => (
            <StatusBadge key={c.status} status={c.status} data-testid={`sb-${c.status}`} />
          ))}
        </div>
      );
      await Promise.resolve();
    });

    // Validate each rendered badge
    for (const c of cases) {
      const el = container.querySelector(`[data-testid="sb-${c.status}"]`) as HTMLSpanElement | null;
      expect(el).toBeTruthy();

      const expected = EXPECTED[c.colorKey];
      const label = statusLabel(c.status);

      expect(el?.textContent).toBe(label);

      const cs = window.getComputedStyle(el as Element);
      const expectedBg = expected.bg.startsWith("#") ? hexToRgb(expected.bg) : expected.bg;
      const normBg = cs.backgroundColor.replace(/\s+/g, "");
      const normExpectedBg = expectedBg.replace(/\s+/g, "");
      expect(normBg).toBe(normExpectedBg);

      const expectedRgb = hexToRgb(expected.text).replace(/\s+/g, "");
      const normColor = cs.color.replace(/\s+/g, "");
      expect(normColor).toBe(expectedRgb);

      expect(el?.className || "").toContain("rounded-full");
    }
  });
});
