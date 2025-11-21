import { describe, it, expect } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { Dialog, DialogOverlay } from "@/components/ui/dialog";

function renderIntoDocument(node: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  return { container, root };
}

describe("DialogOverlay styling", () => {
  it("uses a lighter dimming backdrop for overlays", async () => {
    const { container, root } = renderIntoDocument(
      <Dialog open>
        <DialogOverlay />
      </Dialog>
    );

    await act(async () => {
      root.render(
        <Dialog open>
          <DialogOverlay />
        </Dialog>
      );
      await Promise.resolve();
    });

    const overlay = container.querySelector(
      "[data-slot=dialog-overlay]"
    ) as HTMLDivElement | null;

    expect(overlay).toBeTruthy();
    const className = overlay?.className || "";

    // Backdrop should be a lighter dim, not fully opaque.
    expect(className).toContain("bg-black/25");
  });

  it("includes fade-in and fade-out animation classes", async () => {
    const { container, root } = renderIntoDocument(
      <Dialog open>
        <DialogOverlay />
      </Dialog>
    );

    await act(async () => {
      root.render(
        <Dialog open>
          <DialogOverlay />
        </Dialog>
      );
      await Promise.resolve();
    });

    const overlay = container.querySelector(
      "[data-slot=dialog-overlay]"
    ) as HTMLDivElement | null;

    expect(overlay).toBeTruthy();
    const className = overlay?.className || "";

    // Ensure the overlay supports fade transitions when opening/closing.
    expect(className).toContain("data-[state=open]:fade-in-0");
    expect(className).toContain("data-[state=closed]:fade-out-0");
  });
});
