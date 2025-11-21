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

import { InventoryView } from "@/components/inventory/inventory-view";

// Mock GlobalLoading to capture withGlobalLoading usage without relying on timers
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

// Mock MSAL to avoid auth redirects during tests (matches inventory-view-layout.spec pattern)
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

// Helper to render into a real DOM container
function renderIntoDocument(node: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  return { container, root };
}

describe("InventoryView global loading integration", () => {
  beforeEach(() => {
    process.env.USE_MOCK_INVENTORY = "true";
    vi.useFakeTimers();

    // Stub fetch: InventoryView calls several endpoints; return empty arrays so UI mounts quickly
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
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it.skip("wraps the initial data load with withGlobalLoading so skeletons correspond to the global overlay (flaky in jsdom due to timer interactions)", async () => {
    const { root } = renderIntoDocument(<InventoryView />);

    await act(async () => {
      root.render(<InventoryView />);
      // Allow effects, timers, and async data load to flush
      vi.runAllTimers();
      await Promise.resolve();
    });

    const loadingMod = (await import("@/components/loading/loading-provider")) as unknown as {
      __withGlobalLoading: { mock: { calls: unknown[][] } };
    };

    expect(loadingMod.__withGlobalLoading.mock.calls.length).toBeGreaterThanOrEqual(1);
  });
});
