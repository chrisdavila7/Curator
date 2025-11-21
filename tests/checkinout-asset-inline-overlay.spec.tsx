import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";

// Avoid real Lottie/canvas work in jsdom
vi.mock("lottie-react", () => {
  const LottieMock = (props: React.ComponentProps<"div">) =>
    React.createElement("div", { ...props, "data-testid": "mock-lottie" });

  return {
    __esModule: true as const,
    default: LottieMock,
  };
});

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

vi.mock("@/components/ui/toast-provider", () => ({
  __esModule: true as const,
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@azure/msal-react", () => ({
  __esModule: true as const,
  useMsal: () => ({
    instance: {
      getActiveAccount: () => null,
      acquireTokenSilent: vi.fn(),
    },
    accounts: [],
  }),
}));

vi.mock("@/components/page-header", () => ({
  __esModule: true as const,
  default: () => <div data-testid="page-header" />,
}));

vi.mock("@/components/user-location-select", () => ({
  __esModule: true as const,
  default: () => <div data-testid="user-location-select" />,
}));

vi.mock("@/components/checkinout/checkinout-tabs", () => ({
  __esModule: true as const,
  default: (props: { isCheckout: boolean; onChange: (next: boolean) => void }) => (
    <button
      type="button"
      data-testid="checkinout-tabs"
      onClick={() => props.onChange(!props.isCheckout)}
    >
      Toggle
    </button>
  ),
}));

vi.mock("@/components/checkinout/finalize-panel-card", () => ({
  __esModule: true as const,
  default: () => <div data-testid="finalize-panel" />,
}));

vi.mock("@/components/templates/pdf-preview-dialog", () => ({
  __esModule: true as const,
  PdfPreviewDialog: () => <div data-testid="pdf-preview-dialog" />,
}));

vi.mock("@/components/asset/asset-details-table", () => ({
  __esModule: true as const,
  AssetDetailsTable: () => <div data-testid="asset-details-table" />,
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

import CheckInOutPage from "@/app/check-in-out/page";

const renderIntoDom = (element: React.ReactElement) => {
  const container = document.createElement("div");
  document.body.innerHTML = "";
  document.body.appendChild(container);
  const root = createRoot(container);
  return { container, root, element };
};

describe("CheckInOutPage asset table loading overlay", () => {
  beforeEach(() => {
    process.env.USE_MOCK_INVENTORY = "true";
    // jsdom does not provide ResizeObserver by default; stub a minimal implementation
    (globalThis as unknown as { ResizeObserver?: new (cb: () => void) => { observe: () => void; disconnect: () => void } }).ResizeObserver =
      class {
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        constructor(_cb: () => void) {}
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        observe() {}
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        disconnect() {}
      };

    vi.useFakeTimers();

    const fetchMock = vi
      .fn()
      .mockImplementation(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : (input as Request).url || input.toString();
        if (url.includes("/api/inventory/1323")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              asset: 1323,
              userLocation: "Inventory",
              status: "ready_to_deploy",
              serial: "SN-1323",
              model: "Model-X",
              assetImage: "/window.svg",
              notes: "",
              modified: "2025-08-19",
              modifiedBy: "Tester",
              created: "2025-08-01",
              createdBy: "Procurement",
            }),
          } as Response;
        }
        return {
          ok: false,
          status: 404,
          text: async () => "Not found",
        } as Response;
      }) as unknown as typeof fetch;

    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("does not use the global loading overlay when looking up an asset", async () => {
    const { root, element, container } = renderIntoDom(<CheckInOutPage />);

    await act(async () => {
      root.render(element);
      await Promise.resolve();
    });

    const input = container.querySelector<HTMLInputElement>("#asset-number");
    expect(input).toBeTruthy();

    await act(async () => {
      if (input) {
        input.value = "1323";
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
      await Promise.resolve();
    });

    // Advance debounce timer to trigger lookup
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    const overlayEl = container.querySelector("[data-testid='asset-inline-overlay']");
    expect(overlayEl).toBeNull();

    const loadingMod = (await import("@/components/loading/loading-provider")) as unknown as {
      __withGlobalLoading: { mock: { calls: unknown[][] } };
    };

    expect(loadingMod.__withGlobalLoading.mock.calls.length).toBe(0);
  });
});
