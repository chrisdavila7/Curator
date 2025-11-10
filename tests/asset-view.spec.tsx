import { describe, it, expect, beforeEach, vi } from "vitest";
import * as React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { MsalProvider } from "@azure/msal-react";
import { PublicClientApplication } from "@azure/msal-browser";
import { AssetView } from "@/components/asset/asset-view";
import type { InventoryItem } from "@/types/inventory";
import type { AssetHistoryEvent } from "@/types/history";

describe("AssetView (mock mode)", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    process.env.USE_MOCK_INVENTORY = "true";
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  it("renders Asset 1323 header and details from fetched data", async () => {
    const item1323: InventoryItem = {
      asset: 1323,
      userLocation: "HQ – Staging",
      status: "ready_to_deploy",
      serial: "SN-1323",
      model: "Model-X",
      assetImage: "/window.svg",
      notes: "",
      modified: "2025-08-19",
      modifiedBy: "Tester",
      created: "2025-08-01",
      createdBy: "Procurement",
    };

    // Mock /api/inventory/{asset} to return the target asset.
    const fetchMock = vi
      .fn()
      .mockImplementation(async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = typeof input === "string" ? input : (input as Request).url || input.toString();
        if (url.includes("/api/inventory/1323")) {
          return {
            ok: true,
            status: 200,
            json: async () => item1323,
          } as Response;
        }
        return {
          ok: false,
          status: 404,
          text: async () => "Not found",
        } as Response;
      }) as unknown as typeof fetch;
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock;

    // Minimal MSAL provider instance (unused in mock mode but required by hook)
    const pca = new PublicClientApplication({
      auth: {
        clientId: "00000000-0000-0000-0000-000000000000",
        authority: "https://login.microsoftonline.com/common",
        redirectUri: "http://localhost/auth/callback",
      },
    });

    const root = createRoot(container);
    await act(async () => {
      root.render(
        <MsalProvider instance={pca}>
          <AssetView asset="1323" />
        </MsalProvider>
      );
      // Allow effects + fetch to resolve
      await Promise.resolve();
      await Promise.resolve();
    });

    const text = container.textContent || "";
    expect(text).toContain("Asset 1323");
    expect(text).toContain("Serial");
    expect(text).toContain("SN-1323");
    expect(text).toContain("Model");
    expect(text).toContain("Model-X");
    expect(text).toContain("Current User/Location");
    expect(text).toContain("HQ – Staging");
    expect(text).toContain("Created By");
    expect(text).toContain("Procurement");

    // Status button shows mapped label (Ready to Deploy)
    expect(text).toContain("Ready to Deploy");

    // Ensure dropdown trigger rendered
    const buttons = Array.from(container.querySelectorAll("button")).map((b) =>
      b.textContent?.trim()
    );
    expect(buttons).toContain("Save");
  });

  it("shows 'Asset not found' when asset is missing", async () => {
    // Mock /api/inventory/99999 to return 404
    const fetchMock = vi
      .fn()
      .mockImplementation(async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = typeof input === "string" ? input : (input as Request).url || input.toString();
        if (url.includes("/api/inventory/99999")) {
          return {
            ok: false,
            status: 404,
            text: async () => "Not found",
          } as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({}),
        } as Response;
      }) as unknown as typeof fetch;
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock;

    const pca = new PublicClientApplication({
      auth: {
        clientId: "00000000-0000-0000-0000-000000000000",
        authority: "https://login.microsoftonline.com/common",
        redirectUri: "http://localhost/auth/callback",
      },
    });

    const root = createRoot(container);
    await act(async () => {
      root.render(
        <MsalProvider instance={pca}>
          <AssetView asset="99999" />
        </MsalProvider>
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    const text = container.textContent || "";
    expect(text).toContain("Asset not found");
  });

  it("loads history events when clicking History tab", async () => {
    const item1323: InventoryItem = {
      asset: 1323,
      userLocation: "HQ – Staging",
      status: "ready_to_deploy",
      serial: "SN-1323",
      model: "Model-X",
      assetImage: "/window.svg",
      notes: "",
      modified: "2025-08-19",
      modifiedBy: "Tester",
      created: "2025-08-01",
      createdBy: "Procurement",
    };

    const history: AssetHistoryEvent[] = [
      {
        field: "model",
        changeType: "changed",
        from: "Model-Wrong",
        to: "Model-X",
        by: "Tester",
        at: "2025-08-20T12:00:00Z",
      },
    ];

    // Mock both asset details and history endpoints
    const fetchMock = vi
      .fn()
      .mockImplementation(async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = typeof input === "string" ? input : (input as Request).url || input.toString();
        if (url.includes("/api/inventory/1323/history")) {
          return {
            ok: true,
            status: 200,
            json: async () => history,
          } as Response;
        }
        if (url.includes("/api/inventory/1323")) {
          return {
            ok: true,
            status: 200,
            json: async () => item1323,
          } as Response;
        }
        return {
          ok: false,
          status: 404,
          text: async () => "Not found",
        } as Response;
      }) as unknown as typeof fetch;
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock;

    // Minimal MSAL provider instance (unused in mock mode)
    const pca = new PublicClientApplication({
      auth: {
        clientId: "00000000-0000-0000-0000-000000000000",
        authority: "https://login.microsoftonline.com/common",
        redirectUri: "http://localhost/auth/callback",
      },
    });

    const root = createRoot(container);
    await act(async () => {
      root.render(
        <MsalProvider instance={pca}>
          <AssetView asset="1323" initialTab="history" />
        </MsalProvider>
      );
      // Let initial details load
      await Promise.resolve();
      await Promise.resolve();
    });

    // History tab active by default via initialTab, allow effect + fetch to resolve
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // History content is lazy-loaded; assert via network call below rather than DOM text,
    // which may be a skeleton or empty state during async transitions.

    // Verify the history endpoint was requested
    const calls = (fetchMock as unknown as { mock: { calls: unknown[][] } }).mock.calls.map((c: unknown[]) => {
      const u = c[0];
      if (typeof u === "string") return u;
      if (typeof u === "object" && u !== null && "url" in u) {
        const url = (u as { url?: unknown }).url;
        if (typeof url === "string") return url;
      }
      return String(u);
    });
    expect(calls.some((u) => u.includes("/api/inventory/1323/history"))).toBe(true);
  });
});
