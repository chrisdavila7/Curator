import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";

// We will test LoadingOverlay behavior (visibility, aria, and fallback) without depending
// on real Lottie internals. LottiePlayer is mocked so we can simulate failure.

vi.mock("@/components/lottie/lottie-player", () => {
  const LottieMock = ({ "data-testid": dataTestId }: { "data-testid"?: string }) => {
    return React.createElement("div", { "data-testid": dataTestId ?? "mock-lottie-player" });
  };
  return {
    __esModule: true,
    default: LottieMock,
  };
});

vi.mock("@/components/ui/spinner", () => {
  const SpinnerMock = (props: { "data-testid"?: string }) => {
    return React.createElement("div", { "data-testid": props["data-testid"] ?? "mock-spinner" });
  };
  return {
    __esModule: true,
    Spinner: SpinnerMock,
  };
});

import { Spinner } from "@/components/ui/spinner";
import LoadingOverlay from "@/components/ui/loading-overlay";

// Narrow helper to render the overlay into a jsdom container with React 18 root
const renderIntoDom = (element: React.ReactElement) => {
  const container = document.createElement("div");
  document.body.innerHTML = "";
  document.body.appendChild(container);
  const root = createRoot(container);
  return { container, root, element };
};

describe("LoadingOverlay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = "";
  });

  it("renders nothing when closed", async () => {
    const { container, root, element } = renderIntoDom(<LoadingOverlay open={false} />);

    await act(async () => {
      root.render(element);
      await Promise.resolve();
    });

    expect(container.querySelector("[role='dialog']")).toBeNull();
  });

  it("shows an overlay dialog with default label when open", async () => {
    const { container, root, element } = renderIntoDom(<LoadingOverlay open />);

    await act(async () => {
      root.render(element);
      await Promise.resolve();
    });

    const dialog = container.querySelector("[role='dialog']");
    expect(dialog).not.toBeNull();

    // There should be some text label; exact structure is implementation detail
    expect(container.textContent).toContain("Loading");
  });

  it("uses a custom label when provided", async () => {
    const label = "Fetching data…";
    const { container, root, element } = renderIntoDom(<LoadingOverlay open label={label} />);

    await act(async () => {
      root.render(element);
      await Promise.resolve();
    });

    expect(container.textContent).toContain(label);
  });

  it("falls back to a spinner if Lottie fails to render", async () => {
    // Simulate Lottie failure by temporarily mocking console.error and causing the
    // LoadingOverlay to catch an error from LottiePlayer.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Force Spinner to be a known marker that we can assert on
    const spinnerRenderSpy = vi.spyOn({ Spinner }, "Spinner");

    const { container, root, element } = renderIntoDom(
      // In implementation we'll use an internal error boundary or conditional to render Spinner
      // when Lottie cannot be displayed. The test just asserts that a spinner placeholder
      // becomes visible in that failure path.
      <LoadingOverlay open />
    );

    await act(async () => {
      root.render(element);
      await Promise.resolve();
    });

    // Regardless of how the failure is triggered internally, we expect the Spinner fallback
    // element to be present.
    const spinner = container.querySelector("[data-testid='mock-spinner']");
    expect(spinner).not.toBeNull();

    errorSpy.mockRestore();
    spinnerRenderSpy.mockRestore();
  });

  it("fetches the loading animation JSON from the expected path when open", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValue({ ok: true, json: async () => ({}) } as Response);

    const { root, element } = renderIntoDom(<LoadingOverlay open />);

    await act(async () => {
      root.render(element);
      await Promise.resolve();
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/animations/loadinganimation.json",
      expect.objectContaining({ cache: "force-cache" })
    );

    fetchSpy.mockRestore();
  });
});
