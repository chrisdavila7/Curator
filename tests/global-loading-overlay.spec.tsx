import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";

import { GlobalLoadingProvider, useGlobalLoading } from "@/components/loading/loading-provider";

vi.mock("@/components/lottie/overlay-provider", () => {
  const open = vi.fn();
  const close = vi.fn();

  return {
    __esModule: true,
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

import GlobalLoadingOverlay from "@/components/loading/global-loading-overlay";

function renderWithProvider(node: React.ReactElement) {
  const container = document.createElement("div");
  document.body.innerHTML = "";
  document.body.appendChild(container);
  const root = createRoot(container);
  return { container, root };
}

describe("GlobalLoadingOverlay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = "";
  });

  it("does not open the Lottie overlay by default when no loading is in progress", async () => {
    const Test = () => (
      <GlobalLoadingProvider>
        <GlobalLoadingOverlay />
      </GlobalLoadingProvider>
    );

    const { root } = renderWithProvider(<Test />);

    await act(async () => {
      root.render(<Test />);
      await Promise.resolve();
    });

    const overlayMod = (await import("@/components/lottie/overlay-provider")) as unknown as {
      __open: { mock: { calls: unknown[][] } };
    };

    expect(overlayMod.__open.mock.calls.length).toBe(0);
  });

  it("opens the Lottie overlay while loading and closes it after loading ends (with delays)", async () => {
    const Test = () => {
      const loading = useGlobalLoading();
      return (
        <>
          <button
            type="button"
            onClick={() => {
              loading.start();
            }}
          >
            start
          </button>
          <button
            type="button"
            onClick={() => {
              loading.stop();
            }}
          >
            stop
          </button>
          <GlobalLoadingOverlay />
        </>
      );
    };

    const App = () => (
      <GlobalLoadingProvider showDelayMs={100} minVisibleMs={200}>
        <Test />
      </GlobalLoadingProvider>
    );

    const { container, root } = renderWithProvider(<App />);

    await act(async () => {
      root.render(<App />);
      await Promise.resolve();
    });

    const startButton = container.querySelector("button:nth-of-type(1)") as HTMLButtonElement | null;
    const stopButton = container.querySelector("button:nth-of-type(2)") as HTMLButtonElement | null;

    expect(startButton).not.toBeNull();
    expect(stopButton).not.toBeNull();

    const overlayMod = (await import("@/components/lottie/overlay-provider")) as unknown as {
      __open: { mock: { calls: unknown[][] } };
      __close: { mock: { calls: unknown[][] } };
    };

    // Initially no calls to open
    expect(overlayMod.__open.mock.calls.length).toBe(0);

    // Start loading; should remain hidden until showDelayMs elapsed (no open yet)
    await act(async () => {
      startButton?.click();
      await Promise.resolve();
    });

    expect(overlayMod.__open.mock.calls.length).toBe(0);

    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    // After delay, open should have been called once with the loading animation URL
    expect(overlayMod.__open.mock.calls.length).toBeGreaterThanOrEqual(1);
    const [optsArg] = overlayMod.__open.mock.calls[0];
    expect(optsArg).toMatchObject({
      url: "/animations/loadinganimation.json",
    });

    // Stop loading; overlay should stay visible for at least minVisibleMs before close
    await act(async () => {
      stopButton?.click();
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(overlayMod.__close.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it("closes the Lottie overlay immediately when loading ends when the minimum visible duration is set to 0", async () => {
    const Test = () => {
      const loading = useGlobalLoading();
      return (
        <>
          <button
            type="button"
            onClick={() => {
              loading.start();
            }}
          >
            start
          </button>
          <button
            type="button"
            onClick={() => {
              loading.stop();
            }}
          >
            stop
          </button>
          <GlobalLoadingOverlay />
        </>
      );
    };

    const App = () => (
      <GlobalLoadingProvider showDelayMs={0} minVisibleMs={0}>
        <Test />
      </GlobalLoadingProvider>
    );

    const { container, root } = renderWithProvider(<App />);

    await act(async () => {
      root.render(<App />);
      await Promise.resolve();
    });

    const startButton = container.querySelector("button:nth-of-type(1)") as HTMLButtonElement | null;
    const stopButton = container.querySelector("button:nth-of-type(2)") as HTMLButtonElement | null;

    expect(startButton).not.toBeNull();
    expect(stopButton).not.toBeNull();

    const overlayMod = (await import("@/components/lottie/overlay-provider")) as unknown as {
      __open: { mock: { calls: unknown[][] } };
      __close: { mock: { calls: unknown[][] } };
    };

    // Start loading and flush timers so the overlay opens immediately
    await act(async () => {
      startButton?.click();
      await Promise.resolve();
      vi.runAllTimers();
    });

    expect(overlayMod.__open.mock.calls.length).toBeGreaterThanOrEqual(1);

    // Stop loading; because minVisibleMs is 0, the overlay should close in the same tick
    await act(async () => {
      stopButton?.click();
      await Promise.resolve();
    });

    expect(overlayMod.__close.mock.calls.length).toBeGreaterThanOrEqual(1);
  });
});
