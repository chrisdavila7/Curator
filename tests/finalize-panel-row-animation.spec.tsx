import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";

// Capture Framer Motion props for both the row content and the status icon.
const captured: {
  contentInitial: unknown;
  contentAnimate: unknown;
  contentTransition: unknown;
  iconInitial: unknown;
  iconAnimate: unknown;
  iconTransition: unknown;
} = {
  contentInitial: null,
  contentAnimate: null,
  contentTransition: null,
  iconInitial: null,
  iconAnimate: null,
  iconTransition: null,
};

vi.mock("framer-motion", () => {
  const motion = {
    div: (props: React.ComponentProps<"div"> & {
      initial?: unknown;
      animate?: unknown;
      transition?: unknown;
      "data-motion-key"?: string;
    }) => {
      if (props["data-motion-key"] === "finalize-row-content") {
        captured.contentInitial = props.initial;
        captured.contentAnimate = props.animate;
        captured.contentTransition = props.transition;
      }
      const { initial, animate, transition, "data-motion-key": _mk, ...rest } =
        props as Record<string, unknown>;
      return React.createElement("div", rest, props.children);
    },
    svg: (props: React.ComponentProps<"svg"> & {
      initial?: unknown;
      animate?: unknown;
      transition?: unknown;
    }) => {
      captured.iconInitial = props.initial;
      captured.iconAnimate = props.animate;
      captured.iconTransition = props.transition;
      const { initial, animate, transition, ...rest } = props as Record<string, unknown>;
      return React.createElement("svg", rest, props.children);
    },
  };

  return {
    __esModule: true,
    motion,
    __captured: captured,
  };
});

type MotionCaptureMod = {
  __captured: typeof captured;
};

describe("FinalizePanelCard row animation", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    captured.contentInitial = null;
    captured.contentAnimate = null;
    captured.contentTransition = null;
    captured.iconInitial = null;
    captured.iconAnimate = null;
    captured.iconTransition = null;
  });

  it("buffers row content movement until after the status icon animation", async () => {
    const { default: FinalizePanelCard } = await import("@/components/checkinout/finalize-panel-card");
    const mod = (await import("framer-motion")) as unknown as MotionCaptureMod;

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <FinalizePanelCard
          stagedIn={[{ asset: 1, serial: "SN1", model: "M1" }]}
          stagedOut={[{ asset: 2, serial: "SN2", model: "M2", from: "Inventory", to: "User A" }]}
          onRemove={() => {}}
          onSubmit={() => {}}
          submitting={false}
        />
      );
      await Promise.resolve();
    });

    const { contentInitial, contentAnimate, contentTransition, iconInitial, iconAnimate, iconTransition } =
      mod.__captured;

    // Basic sanity: both icon and row content should have animation configs
    expect(iconInitial).not.toBeNull();
    expect(iconAnimate).not.toBeNull();
    expect(iconTransition).not.toBeNull();
    expect(contentInitial).not.toBeNull();
    expect(contentAnimate).not.toBeNull();
    expect(contentTransition).not.toBeNull();

    const iconTrans = iconTransition as { duration?: number };
    const contentTrans = contentTransition as { delay?: number };

    const contentInit = contentInitial as { x?: number };
    const contentAnim = contentAnimate as { x?: number };

    // Row content should be offset to the left and animate to x = 0
    expect(typeof contentInit.x === "number").toBe(true);
    expect(contentAnim.x).toBe(0);

    // The content movement should be buffered by at least the icon's duration
    expect(typeof iconTrans.duration === "number").toBe(true);
    expect(typeof contentTrans.delay === "number").toBe(true);
    if (typeof iconTrans.duration === "number" && typeof contentTrans.delay === "number") {
      expect(contentTrans.delay).toBeGreaterThanOrEqual(iconTrans.duration);
    }
  });
});
