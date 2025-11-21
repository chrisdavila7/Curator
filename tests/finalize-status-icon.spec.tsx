import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";

// These tests verify the SVG-based FinalizeStatusIcon behavior.
// The component should:
// - Render a concrete SVG icon for both check-in and check-out rows
// - Use different fills for check-in vs check-out icons
// - Expose an accessible aria-label that differentiates check-in vs check-out
// - No longer render any legacy status band span

describe("FinalizeStatusIcon (SVG icons)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("renders the Check In SVG icon without a band", async () => {
    const { default: FinalizeStatusIcon } = await import("@/components/checkinout/finalize-status-icon");

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<FinalizeStatusIcon kind="in" fallbackColor="#000000" />);
      await Promise.resolve();
    });

    // Icon wrapper
    const icon = container.querySelector('[data-testid="finalize-status-icon"]') as HTMLElement | null;
    expect(icon).toBeTruthy();

    // Should not render any legacy band span
    const band = container.querySelector('span.w-\\[0\\.29rem\\]');
    expect(band).toBeNull();

    const svg = icon!.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg!.getAttribute("aria-label")).toBe("Check In status");

    // Check In icon should contain at least one path filled with the Check In color
    const paths = Array.from(svg!.querySelectorAll("path"));
    const hasCheckInFill = paths.some((p) => p.getAttribute("fill") === "#373753");
    expect(hasCheckInFill).toBe(true);
  });

  it("renders the Check Out SVG icon without a band", async () => {
    const { default: FinalizeStatusIcon } = await import("@/components/checkinout/finalize-status-icon");

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<FinalizeStatusIcon kind="out" fallbackColor="#000000" />);
      await Promise.resolve();
    });

    const icon = container.querySelector('[data-testid="finalize-status-icon"]') as HTMLElement | null;
    expect(icon).toBeTruthy();

    const band = container.querySelector('span.w-\\[0\\.29rem\\]');
    expect(band).toBeNull();

    const svg = icon!.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg!.getAttribute("aria-label")).toBe("Check Out status");

    const paths = Array.from(svg!.querySelectorAll("path"));
    const hasCheckOutFill = paths.some((p) => p.getAttribute("fill") === "#FA6E4B");
    expect(hasCheckOutFill).toBe(true);
  });
});
