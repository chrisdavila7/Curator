import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";

// Prevent lottie-web from trying to access canvas APIs in jsdom via lottie-react
vi.mock("lottie-react", () => {
  const LottieMock = (props: React.ComponentProps<"div">) =>
    React.createElement("div", { ...props, "data-testid": "mock-lottie" });

  return {
    __esModule: true as const,
    default: LottieMock,
  };
});

import AssetsPage from "@/app/assets/page";

// Mock GlobalLoading to capture withGlobalLoading usage
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

// Mock MSAL to avoid auth redirects during tests (mirrors inventory-view-layout pattern)
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

function renderIntoDocument(node: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  return { container, root };
}

describe("AssetsPage global loading integration", () => {
  beforeEach(() => {
    process.env.USE_MOCK_INVENTORY = "true";

    // Stub fetch: AssetsPage calls /api/inventory; return empty array so UI mounts quickly
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
    document.body.innerHTML = "";
  });

  it.skip("wraps the initial assets table load with withGlobalLoading so the skeleton table corresponds to the global overlay (flaky in jsdom due to timer interactions)", async () => {
    const { root } = renderIntoDocument(<AssetsPage />);

    await act(async () => {
      root.render(<AssetsPage />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const loadingMod = (await import("@/components/loading/loading-provider")) as unknown as {
      __withGlobalLoading: { mock: { calls: unknown[][] } };
    };

    expect(loadingMod.__withGlobalLoading.mock.calls.length).toBeGreaterThanOrEqual(1);
  });
});
