import React, { createRef } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import LottiePlayer, { LottiePlayerRef } from "@/components/lottie/lottie-player";

// Mock lottie-react without require(); attach a stable mocked instance to lottieRef
vi.mock("lottie-react", () => {
  const instance = {
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    setSpeed: vi.fn(),
    setDirection: vi.fn(),
    goToAndStop: vi.fn(),
    playSegments: vi.fn(),
  } as unknown as LottiePlayerRef;

  type LottieMockProps = {
    lottieRef?: React.MutableRefObject<LottiePlayerRef | null>;
  } & React.ComponentProps<"div">;

  const LottieMock = (props: LottieMockProps) => {
    if (props?.lottieRef && "current" in props.lottieRef) {
      props.lottieRef.current = instance;
    }
    return React.createElement("div", { "data-testid": "mock-lottie" });
  };

  return {
    __esModule: true,
    default: LottieMock,
  };
});

describe("LottiePlayer (foundation only)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = "";
  });

  it("renders without crashing and exposes imperative methods via ref", async () => {
    const ref = createRef<LottiePlayerRef>();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<LottiePlayer animationData={{}} ref={ref} />);
      // Allow effects to run
      await Promise.resolve();
      await Promise.resolve();
    });

    const el = container.querySelector('[data-testid="mock-lottie"]');
    expect(el).toBeTruthy();

    expect(typeof ref.current?.play).toBe("function");
    expect(typeof ref.current?.pause).toBe("function");
    expect(typeof ref.current?.stop).toBe("function");
    expect(typeof ref.current?.setSpeed).toBe("function");
    expect(typeof ref.current?.setDirection).toBe("function");
  });

  it("applies speed and direction via imperative API when provided", async () => {
    const ref = createRef<LottiePlayerRef>();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<LottiePlayer animationData={{}} ref={ref} speed={1.5} direction={-1} />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const setSpeed = ref.current?.setSpeed as unknown as { mock: { calls: unknown[][] } } | undefined;
    const setDirection = ref.current?.setDirection as unknown as { mock: { calls: unknown[][] } } | undefined;

    expect(setSpeed).toBeTruthy();
    expect(setDirection).toBeTruthy();

    expect(setSpeed!.mock.calls.some((c) => c[0] === 1.5)).toBe(true);
    expect(setDirection!.mock.calls.some((c) => c[0] === -1)).toBe(true);
  });
});
