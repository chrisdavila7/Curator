import { describe, it, expect, vi } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";

import FinalizeCard from "@/components/checkinout/finalize-card";
import FinalizePanelCard from "@/components/checkinout/finalize-panel-card";
import { STATUS_COLORS } from "@/lib/status-colors";

// This suite asserts color usage only; mock lottie-react to avoid jsdom canvas issues.
vi.mock("lottie-react", () => {
  const LottieMock = () => React.createElement("div", { "data-testid": "mock-lottie" });
  return {
    __esModule: true,
    default: LottieMock,
  };
});

// Convert a hex color to the rgb(...) string that the browser serializes inline styles to.
function hexToRgb(hex: string): string {
  const raw = hex.replace("#", "");
  const h = raw.length === 8 ? raw.slice(0, 6) : raw; // support rrggbbaa by dropping alpha
  const bigint = parseInt(h, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgb(${r}, ${g}, ${b})`;
}

const EXPECTED = {
  ready: { bg: STATUS_COLORS.ready.bg, text: STATUS_COLORS.ready.text },
  deployed: { bg: STATUS_COLORS.deployed.bg, text: STATUS_COLORS.deployed.text },
};

describe("FinalizeCard and FinalizePanelCard colors", () => {
  it("FinalizeCard (inline) uses STATUS_COLORS for in/out counts", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<FinalizeCard variant="inline" inCount={2} outCount={3} />);
      await Promise.resolve();
    });

    const nums = Array.from(container.querySelectorAll("span.tabular-nums")) as HTMLSpanElement[];
    expect(nums.length).toBe(2);

    const csIn = window.getComputedStyle(nums[0]);
    const csOut = window.getComputedStyle(nums[1]);

    // Ready to Deploy (in) should use ready.text
    expect(csIn.color.replace(/\s+/g, "")).toBe(hexToRgb(EXPECTED.ready.text).replace(/\s+/g, ""));

    // Deployed (out) should use deployed.text
    expect(csOut.color.replace(/\s+/g, "")).toBe(hexToRgb(EXPECTED.deployed.text).replace(/\s+/g, ""));
  });

  it("FinalizeCard (sidebar) uses STATUS_COLORS for in/out counts", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<FinalizeCard inCount={1} outCount={1} />);
      await Promise.resolve();
    });

    const nums = Array.from(container.querySelectorAll("span.tabular-nums")) as HTMLSpanElement[];
    expect(nums.length).toBe(2);

    const csIn = window.getComputedStyle(nums[0]);
    const csOut = window.getComputedStyle(nums[1]);

    expect(csIn.color.replace(/\s+/g, "")).toBe(hexToRgb(EXPECTED.ready.text).replace(/\s+/g, ""));
    expect(csOut.color.replace(/\s+/g, "")).toBe(hexToRgb(EXPECTED.deployed.text).replace(/\s+/g, ""));
  });

  it("FinalizePanelCard renders distinct Check In / Check Out SVG icon fills", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <FinalizePanelCard
          stagedIn={[{ asset: 1, serial: "SN1", model: "M1" }]}
          stagedOut={[{ asset: 2, serial: "SN2", model: "M2", from: "Inventory", to: "User A" }]}
          onRemove={() => {}}
          onSubmit={() => {}}
          submitting={false}
        />
      );
      await Promise.resolve();
    });

    const icons = Array.from(
      container.querySelectorAll('[data-testid="finalize-status-icon"]')
    ) as HTMLElement[];
    expect(icons.length).toBe(2);

    const getFirstPathFill = (icon: HTMLElement): string | null => {
      const svg = icon.querySelector("svg");
      if (!svg) return null;
      const path = svg.querySelector("path");
      return path ? path.getAttribute("fill") : null;
    };

    const inFill = getFirstPathFill(icons[0]);
    const outFill = getFirstPathFill(icons[1]);

    expect(inFill).toBe("#373753");
    expect(outFill).toBe("#FA6E4B");
  });
});
