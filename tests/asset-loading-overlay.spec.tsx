import React from "react";
import { describe, it, expect, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";

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

// Import after mocking overlay provider
import Loading from "@/app/asset/[asset]/loading";

const renderIntoDom = (element: React.ReactElement) => {
  const container = document.createElement("div");
  document.body.innerHTML = "";
  document.body.appendChild(container);
  const root = createRoot(container);
  return { container, root, element };
};

describe("Asset route loading overlay", () => {
  it("opens the Lottie overlay with the shared loading animation and closes it on unmount", async () => {
    const { root, element } = renderIntoDom(<Loading />);

    await act(async () => {
      root.render(element);
      await Promise.resolve();
    });

    const overlayMod = (await import("@/components/lottie/overlay-provider")) as unknown as {
      __open: { mock: { calls: unknown[][] } };
      __close: { mock: { calls: unknown[][] } };
    };

    expect(overlayMod.__open.mock.calls.length).toBe(1);
    const [optsArg] = overlayMod.__open.mock.calls[0];
    expect(optsArg).toMatchObject({
      url: "/animations/loadinganimation.json",
    });

    await act(async () => {
      root.unmount();
      await Promise.resolve();
    });

    expect(overlayMod.__close.mock.calls.length).toBe(1);
  });
});
