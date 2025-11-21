import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MsalProvider } from "@azure/msal-react";
import { PublicClientApplication } from "@azure/msal-browser";
import type { InventoryItem } from "@/types/inventory";
import type { AssetHistoryEvent } from "@/types/history";

// Prevent lottie-web from trying to access canvas APIs in jsdom via lottie-react
vi.mock("lottie-react", () => {
  const LottieMock = (props: React.ComponentProps<"div">) =>
    React.createElement("div", { ...props, "data-testid": "mock-lottie" });

  return {
    __esModule: true as const,
    default: LottieMock,
  };
});

import { AssetView } from "@/components/asset/asset-view";

vi.mock("@/components/loading/loading-provider", () => {
  const withGlobalLoading = vi.fn(async <T,>(p: Promise<T>): Promise<T> => p);

  return {
    __esModule: true as const,
    useGlobalLoading: () => ({
      start: vi.fn(),
      stop: vi.fn(),
      withGlobalLoading,
      count: 0,
      visible: false,
    }),
    __withGlobalLoading: withGlobalLoading,
  };
});

vi.mock("@/components/lottie/overlay-provider", () => {
  const open = vi.fn();
  const close = vi.fn();

  return {
    __esModule: true as const,
    useLottieOverlay: () => ({
      isOpen: false,
      animationData: null,
      spinner: false,
      loop: false,
      autoplay: true,
      speed: undefined,
      version: 0,
      open,
      close,
      closeWith: undefined,
    }),
    __open: open,
    __close: close,
  };
});

function renderIntoDocument(node: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  return { container, root };
}

const createPca = () =>
  new PublicClientApplication({
    auth: {
      clientId: "00000000-0000-0000-0000-000000000000",
      authority: "https://login.microsoftonline.com/common",
      redirectUri: "http://localhost/auth/callback",
    },
  });

describe("AssetView global loading integration (mock mode)", () => {
  beforeEach(() => {
    process.env.USE_MOCK_INVENTORY = "true";
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("wraps the initial asset details load with withGlobalLoading", async () => {
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

    const fetchMock = vi
      .fn()
      .mockImplementation(async (input: RequestInfo | URL) => {
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

    const pca = createPca();
    const { root } = renderIntoDocument(
      <MsalProvider instance={pca}>
        <AssetView asset="1323" />
      </MsalProvider>
    );

    await act(async () => {
      root.render(
        <MsalProvider instance={pca}>
          <AssetView asset="1323" />
        </MsalProvider>
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    const loadingMod = (await import("@/components/loading/loading-provider")) as unknown as {
      __withGlobalLoading: { mock: { calls: unknown[][] } };
    };

    expect(loadingMod.__withGlobalLoading.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it("wraps the first history load with withGlobalLoading when History tab is active", async () => {
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

    const fetchMock = vi
      .fn()
      .mockImplementation(async (input: RequestInfo | URL) => {
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

    const pca = createPca();
    const { root } = renderIntoDocument(
      <MsalProvider instance={pca}>
        <AssetView asset="1323" initialTab="history" />
      </MsalProvider>
    );

    await act(async () => {
      root.render(
        <MsalProvider instance={pca}>
          <AssetView asset="1323" initialTab="history" />
        </MsalProvider>
      );
      // Let initial details + history effects run
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const loadingMod = (await import("@/components/loading/loading-provider")) as unknown as {
      __withGlobalLoading: { mock: { calls: unknown[][] } };
    };

    expect(loadingMod.__withGlobalLoading.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
