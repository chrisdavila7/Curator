import { describe, it, expect, vi, beforeEach } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";

// Stub the AssetViewOverlay to avoid MSAL/fetch complexity and to
// surface route behavior (asset param + close -> navigation).
const mockOnOpenChange = vi.fn();

vi.mock("@/components/asset/asset-view-overlay", () => {
  return {
    __esModule: true,
    default: function AssetViewOverlayStub(props: {
      open: boolean;
      onOpenChange: (open: boolean) => void;
      asset?: number | string | null;
    }) {
      return (
        <div
          data-test="asset-overlay-stub"
          data-open={props.open ? "true" : "false"}
          data-asset={props.asset ?? ""}
        >
          <div>Asset Overlay for {String(props.asset ?? "")}</div>
          <button
            type="button"
            data-test="close-overlay"
            onClick={() => props.onOpenChange(false)}
          >
            Close
          </button>
        </div>
      );
    },
  };
});

// Mock next/navigation router so we can assert back()/push() behavior.
const mockBack = vi.fn();
const mockPush = vi.fn();

vi.mock("next/navigation", () => {
  return {
    __esModule: true,
    useRouter: () => ({
      back: mockBack,
      push: mockPush,
    }),
  };
});

// Import the route component under test (client page component)
import AssetPage from "@/app/asset/[asset]/page";

function renderIntoDocument(node: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  return { container, root };
}

describe("/asset/[asset] route overlay behavior", () => {
  beforeEach(() => {
    mockBack.mockReset();
    mockPush.mockReset();
  });

  it("renders an overlay for the requested asset", async () => {
    const { container, root } = renderIntoDocument(
      <AssetPage params={Promise.resolve({ asset: "1323" })} />
    );

    await act(async () => {
      root.render(<AssetPage params={Promise.resolve({ asset: "1323" })} />);
      await Promise.resolve();
    });

    const overlay = container.querySelector(
      "[data-test=asset-overlay-stub]"
    ) as HTMLDivElement | null;

    expect(overlay).toBeTruthy();
    expect(overlay?.dataset.asset).toBe("1323");
    expect(container.textContent || "").toContain("Asset Overlay for 1323");
  });

  it("calls router.back() when closing overlay and there is navigation history", async () => {
    // Simulate existing history (user navigated here from another page)
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      window.history,
      "length"
    );
    Object.defineProperty(window.history, "length", {
      configurable: true,
      get: () => 3,
    });

    const { container, root } = renderIntoDocument(
      <AssetPage params={Promise.resolve({ asset: "2001" })} />
    );

    await act(async () => {
      root.render(<AssetPage params={Promise.resolve({ asset: "2001" })} />);
      await Promise.resolve();
    });

    const closeButton = container.querySelector(
      "button[data-test=close-overlay]"
    ) as HTMLButtonElement | null;
    expect(closeButton).toBeTruthy();

    await act(async () => {
      closeButton?.click();
      await Promise.resolve();
    });

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();

    // restore original descriptor
    if (originalDescriptor) {
      Object.defineProperty(window.history, "length", originalDescriptor);
    }
  });

  it("navigates to /dashboard when closing overlay without history (direct entry)", async () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      window.history,
      "length"
    );
    Object.defineProperty(window.history, "length", {
      configurable: true,
      get: () => 1,
    });

    const { container, root } = renderIntoDocument(
      <AssetPage params={Promise.resolve({ asset: "777" })} />
    );

    await act(async () => {
      root.render(<AssetPage params={Promise.resolve({ asset: "777" })} />);
      await Promise.resolve();
    });

    const closeButton = container.querySelector(
      "button[data-test=close-overlay]"
    ) as HTMLButtonElement | null;
    expect(closeButton).toBeTruthy();

    await act(async () => {
      closeButton?.click();
      await Promise.resolve();
    });

    expect(mockBack).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/dashboard");

    if (originalDescriptor) {
      Object.defineProperty(window.history, "length", originalDescriptor);
    }
  });
});
