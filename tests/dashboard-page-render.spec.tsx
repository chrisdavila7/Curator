import { describe, it, expect, vi } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";

// Mock MSAL hooks used by SearchCommand and InventoryView
vi.mock("@azure/msal-react", () => ({
  useMsal: () => ({
    instance: {
      initialize: vi.fn(async () => {}),
      acquireTokenSilent: vi.fn(async () => {
        // Simulate unauthenticated state in tests; SearchCommand should handle gracefully
        throw new Error("no auth in test");
      }),
      loginRedirect: vi.fn(async () => {}),
      getActiveAccount: vi.fn(() => null),
    },
    accounts: [],
  }),
}));

// Mock Next.js navigation (used by SearchCommand)
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Stub InventoryView to avoid network calls in tests
vi.mock("@/components/inventory/inventory-view", () => ({
  InventoryView: () => <div data-test="inventory-view-stub" />,
}));

// Import the Dashboard page (server component that renders client components)
import DashboardPage from "@/app/dashboard/page";

function renderIntoDocument(node: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  return { container, root };
}

describe("Dashboard page", () => {
  it("renders CURATOR header and no header Search Bar", async () => {
    const { container, root } = renderIntoDocument(<DashboardPage />);

    await act(async () => {
      root.render(<DashboardPage />);
      await Promise.resolve();
    });

    // Header present
    const text = container.textContent || "";
    expect(text).toContain("CURATOR");

    // Header Search Bar should be removed; SearchCommand is no longer rendered on the dashboard
    const input = container.querySelector('input[placeholder="Search inventory or actions…"]');
    expect(input).toBeFalsy();

    // Inventory view stub present (confirms the rest of the dashboard renders)
    const stub = container.querySelector('[data-test="inventory-view-stub"]');
    expect(stub).toBeTruthy();
  });
});
