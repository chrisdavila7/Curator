import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { InventoryView } from "@/components/inventory/inventory-view";

// Mock MSAL to avoid auth redirects during tests
vi.mock("@azure/msal-react", () => ({
  useMsal: () => ({
    instance: {
      initialize: vi.fn(async () => {}),
      acquireTokenSilent: vi.fn(async () => {
        throw new Error("no auth in test");
      }),
      loginRedirect: vi.fn(async () => {}),
      getActiveAccount: vi.fn(() => null),
    },
    accounts: [],
  }),
}));

// Helper to render into a real DOM container
function renderIntoDocument(node: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  return { container, root };
}

describe("InventoryView layout", () => {
  beforeEach(() => {
    // Force mock mode (also set in tests/setup.ts, this is a safeguard for direct runs)
    process.env.USE_MOCK_INVENTORY = "true";

    // Stub fetch: InventoryView calls several endpoints; return empty arrays so UI mounts quickly
    // Type cast is required because we're providing a narrow Response-like shape that satisfies InventoryView usage.
    // This is acceptable in tests to isolate layout behavior from network concerns.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as unknown as { fetch: typeof fetch }).fetch = vi.fn(async () => {
      return {
        ok: true,
        status: 200,
        json: async () => [],
        text: async () => "[]",
      } as unknown as Response;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders "Recent Activity" wrapper to span the full grid width (no shrink) matching top cards', async () => {
    const { container, root } = renderIntoDocument(<InventoryView />);

    await act(async () => {
      root.render(<InventoryView />);
      // Allow effects and async data load to flush
      await Promise.resolve();
      await Promise.resolve();
    });

    // The skeleton also shows a "Recent Activity" header, but the loaded state wraps it
    // in a specific gradient wrapper. Poll briefly until loaded content appears.
    let wrapper: HTMLElement | null = null;
    for (let i = 0; i < 5; i++) {
      wrapper = container.querySelector(
        '[data-test="recent-activity-wrapper"]'
      ) as HTMLElement | null;
      if (wrapper) break;
      // flush microtasks
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        await Promise.resolve();
      });
    }

    expect(wrapper).toBeTruthy();

    const className = wrapper!.className;
    // It must span all three grid columns at md+ breakpoints
    expect(className).toContain("md:col-span-3");
    // It must take the full available width of the grid track (no shrink to content)
    expect(className).toContain("w-full");
    // It must not be sized by content width
    expect(className).not.toContain("w-fit");

    // Sanity check: the card inside should also be full width
    const card = container.querySelector(
      '[data-test="recent-activity-card"]'
    ) as HTMLElement | null;
    expect(card).toBeTruthy();
    expect(card!.className).toContain("w-full");
  });

  it('keeps recent activity content inside wrapper (no horizontal overflow)', async () => {
    const { container, root } = renderIntoDocument(<InventoryView />);

    await act(async () => {
      root.render(<InventoryView />);
      await Promise.resolve();
      await Promise.resolve();
    });

    // Wait for content to mount
    let content: HTMLElement | null = null;
    for (let i = 0; i < 5; i++) {
      content = container.querySelector(
        '[data-test="recent-activity-content"]'
      ) as HTMLElement | null;
      if (content) break;
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        await Promise.resolve();
      });
    }

    expect(content).toBeTruthy();
    const cn = content!.className;

    // No horizontal margins that would exceed the wrapper width
    expect(cn).not.toMatch(/\bmx-\d+\b/);
    expect(cn).not.toContain("mx-");

    // Uses padding for internal spacing and occupies available width
    expect(cn).toContain("w-full");
    expect(cn).toContain("px-");

    // Guard against accidental overflow visibility
    expect(cn).not.toContain("overflow-x-visible");
  });

  it("ensures Week and Month cards' inner content fills card height when rows are few", async () => {
    const { container, root } = renderIntoDocument(<InventoryView />);

    await act(async () => {
      root.render(<InventoryView />);
      await Promise.resolve();
      await Promise.resolve();
    });

    // Week selectors
    const weekWrapper = container.querySelector('[data-test="week-card-wrapper"]') as HTMLElement | null;
    const weekCard = container.querySelector('[data-test="week-card"]') as HTMLElement | null;
    const weekContent = container.querySelector('[data-test="week-card-content"]') as HTMLElement | null;
    const weekInner = container.querySelector('[data-test="week-content"]') as HTMLElement | null;

    expect(weekWrapper).toBeTruthy();
    expect(weekCard).toBeTruthy();
    expect(weekContent).toBeTruthy();
    expect(weekInner).toBeTruthy();

    expect(weekWrapper!.className).toContain("h-full");
    expect(weekCard!.className).toContain("h-full");
    expect(weekCard!.className).toContain("flex");
    expect(weekCard!.className).toContain("flex-col");
    expect(weekContent!.className).toContain("flex-1");
    expect(weekInner!.className).toContain("h-full");

    // White DataTable container inside should also fill height
    const weekWhite = weekInner!.querySelector("div.rounded-md.border") as HTMLElement | null;
    expect(weekWhite).toBeTruthy();
    expect(weekWhite!.className).toContain("h-full");

    // Month selectors
    const monthWrapper = container.querySelector('[data-test="month-card-wrapper"]') as HTMLElement | null;
    const monthCard = container.querySelector('[data-test="month-card"]') as HTMLElement | null;
    const monthContent = container.querySelector('[data-test="month-card-content"]') as HTMLElement | null;
    const monthInner = container.querySelector('[data-test="month-content"]') as HTMLElement | null;

    expect(monthWrapper).toBeTruthy();
    expect(monthCard).toBeTruthy();
    expect(monthContent).toBeTruthy();
    expect(monthInner).toBeTruthy();

    expect(monthWrapper!.className).toContain("h-full");
    expect(monthCard!.className).toContain("h-full");
    expect(monthCard!.className).toContain("flex");
    expect(monthCard!.className).toContain("flex-col");
    expect(monthContent!.className).toContain("flex-1");
    expect(monthInner!.className).toContain("h-full");

    // White DataTable container inside should also fill height
    const monthWhite = monthInner!.querySelector("div.rounded-md.border") as HTMLElement | null;
    expect(monthWhite).toBeTruthy();
    expect(monthWhite!.className).toContain("h-full");
  });
});
