import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import CheckInOutLottieToggle from "@/components/checkinout/checkinout-lottie-toggle";
import type { LottiePlayerRef } from "@/components/lottie/lottie-player";

// Mock requestAnimationFrame to run immediately
beforeEach(() => {
  const g = globalThis as unknown as {
    requestAnimationFrame?: (cb: FrameRequestCallback) => number;
    cancelAnimationFrame?: (id: number) => void;
  };
  g.requestAnimationFrame = (cb: FrameRequestCallback) => {
    const id = setTimeout(() => cb(performance.now()), 0) as unknown as number;
    return id;
  };
  g.cancelAnimationFrame = (id: number) => {
    clearTimeout(id as unknown as number);
  };
});

// Mock lottie-react so our LottiePlayer forwards refs and handlers to a controllable instance
vi.mock("lottie-react", () => {
  const instance: Partial<LottiePlayerRef> & { getDuration: (isFrame?: boolean) => number } = {
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    setSpeed: vi.fn(),
    setDirection: vi.fn(),
    goToAndStop: vi.fn(),
    goToAndPlay: vi.fn(),
    playSegments: vi.fn(),
    getDuration: vi.fn(() => 100), // 100 frames
  };

  let lastHandlers: {
    onComplete?: (() => void) | undefined;
    onLoopComplete?: (() => void) | undefined;
    onEnterFrame?: (() => void) | undefined;
  } = {};

  type LottieMockProps = {
    lottieRef?: React.MutableRefObject<Partial<LottiePlayerRef> | null>;
    onComplete?: () => void;
    onLoopComplete?: () => void;
    onEnterFrame?: () => void;
  } & React.ComponentProps<"div">;

  const LottieMock = (props: LottieMockProps) => {
    // capture handlers for tests to call
    lastHandlers = {
      onComplete: props.onComplete,
      onLoopComplete: props.onLoopComplete,
      onEnterFrame: props.onEnterFrame,
    };
    if (props?.lottieRef && "current" in props.lottieRef) {
      props.lottieRef.current = instance as Partial<LottiePlayerRef>;
    }
    return React.createElement("div", { "data-testid": "mock-lottie" });
  };

  return {
    __esModule: true,
    default: LottieMock,
    __instance: instance,
    __lastHandlers: () => lastHandlers,
  };
});

type MockMod = {
  __instance: {
    goToAndPlay: (...args: unknown[]) => unknown;
    goToAndStop: (...args: unknown[]) => unknown;
    getDuration: (...args: unknown[]) => number;
  };
  __lastHandlers: () => {
    onComplete?: () => void;
    onLoopComplete?: () => void;
    onEnterFrame?: () => void;
  };
};

describe("CheckInOutLottieToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = "";
    // Mock fetch for animation JSONs
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => {
      return {
        ok: true,
        json: async () => ({}),
      } as unknown as Response;
    }));
  });

  it("renders and sets initial poster to ~1% (goToAndStop called)", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<CheckInOutLottieToggle />);
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 0));
    });

    const mod = (await import("lottie-react")) as unknown as MockMod;
    // After mount and rAF, initial poster should be set at >= 1
    const calls = (mod.__instance.goToAndStop as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const firstFrame = calls[0][0];
    expect(firstFrame).toBeGreaterThanOrEqual(1);
  });

  it("plays first animation on first click, blocks re-click until complete, then toggles on next clicks", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<CheckInOutLottieToggle />);
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 0));
    });

    const mod = (await import("lottie-react")) as unknown as MockMod;

    const button = container.querySelector('[role="button"]') as HTMLElement;
    expect(button).toBeTruthy();

    // First click -> should start playing c2i from 0
    await act(async () => {
      button.click();
      await Promise.resolve();
    });

    expect(mod.__instance.goToAndPlay).toHaveBeenCalledTimes(1);
    expect(mod.__instance.goToAndPlay).toHaveBeenLastCalledWith(0, true);

    // Attempt another click during playback should be ignored
    await act(async () => {
      button.click();
      await Promise.resolve();
    });
    expect(mod.__instance.goToAndPlay).toHaveBeenCalledTimes(1); // still 1

    // Complete the first animation
    const handlers = mod.__lastHandlers();
    expect(typeof handlers.onComplete).toBe("function");
    await act(async () => {
      handlers.onComplete && handlers.onComplete();
      await Promise.resolve();
    });

    // Second click -> should play the opposite animation (i2c)
    await act(async () => {
      button.click();
      await Promise.resolve();
    });
    expect(mod.__instance.goToAndPlay).toHaveBeenCalledTimes(2);

    // Complete second animation
    const handlers2 = mod.__lastHandlers();
    await act(async () => {
      handlers2.onComplete && handlers2.onComplete();
      await Promise.resolve();
    });

    // Third click -> toggles back
    await act(async () => {
      button.click();
      await Promise.resolve();
    });
    expect(mod.__instance.goToAndPlay).toHaveBeenCalledTimes(3);

    // On each completion, ensure we poster at last frame (99 for 100 total frames)
    const stopCalls = (mod.__instance.goToAndStop as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    // last completion call will set to last frame
    const lastStopFrame = stopCalls[stopCalls.length - 1][0];
    expect(lastStopFrame).toBe(99);
  });

  it("keeps opacity at 100% at rest, during play, and after pause/complete", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<CheckInOutLottieToggle />);
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 0));
    });

    const button = container.querySelector('[role="button"]') as HTMLElement;
    expect(button).toBeTruthy();

    // At rest
    expect(button.className.includes("opacity-100")).toBe(true);
    expect(button.className.includes("opacity-60")).toBe(false);

    // Start playing
    await act(async () => {
      button.click();
      await Promise.resolve();
    });

    expect(button.className.includes("opacity-100")).toBe(true);
    expect(button.className.includes("opacity-60")).toBe(false);

    // Complete/paused poster
    const mod2 = (await import("lottie-react")) as unknown as MockMod;
    const handlers = mod2.__lastHandlers();
    await act(async () => {
      handlers.onComplete && handlers.onComplete();
      await Promise.resolve();
    });

    expect(button.className.includes("opacity-100")).toBe(true);
    expect(button.className.includes("opacity-60")).toBe(false);
  });

  it("fetches updated animations with no-store cache", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<CheckInOutLottieToggle />);
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 0));
    });

    const fetchMock = globalThis.fetch as unknown as { mock: { calls: unknown[][] } };
    const calls = fetchMock.mock.calls as unknown[][];

    const calledC2I = calls.some(
      (c) => c[0] === "/animations/checkouttocheckin.json" && (c[1] as { cache?: string })?.cache === "no-store"
    );
    const calledI2C = calls.some(
      (c) => c[0] === "/animations/checkintocheckout.json" && (c[1] as { cache?: string })?.cache === "no-store"
    );

    expect(calledC2I).toBe(true);
    expect(calledI2C).toBe(true);
  });

  it("calls onModeChange(false) after initial poster to c2i", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onModeChange = vi.fn();

    await act(async () => {
      root.render(<CheckInOutLottieToggle onModeChange={onModeChange} />);
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(onModeChange).toHaveBeenCalled();
    expect(onModeChange).toHaveBeenCalledWith(false);
  });

  it("emits onModeChange mapping on animation complete (true for i2c, false for c2i)", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onModeChange = vi.fn();

    await act(async () => {
      root.render(<CheckInOutLottieToggle onModeChange={onModeChange} />);
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 0));
    });

    const mod = (await import("lottie-react")) as unknown as MockMod;
    const button = container.querySelector('[role="button"]') as HTMLElement;

    // First click plays c2i, then complete
    await act(async () => {
      button.click();
      await Promise.resolve();
    });
  const handlers1 = mod.__lastHandlers();
  await act(async () => {
    handlers1.onComplete && handlers1.onComplete();
    await Promise.resolve();
  });
  expect(onModeChange).toHaveBeenCalledWith(false);

    // Second click plays i2c, then complete
    await act(async () => {
      button.click();
      await Promise.resolve();
    });
  const handlers2 = mod.__lastHandlers();
  await act(async () => {
    handlers2.onComplete && handlers2.onComplete();
    await Promise.resolve();
  });
  expect(onModeChange).toHaveBeenCalledWith(true);
  });
});
