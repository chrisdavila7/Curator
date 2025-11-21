import { describe, it, expect, vi } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";

// 1) App shell main surface should not paint a solid background over the page
import { SidebarInset } from "@/components/ui/sidebar";

// 2) Unauthenticated routes wrapper should not set a solid background (lets body show through)
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

import { ClientLayoutShell } from "@/app/client-layout-shell";

function renderIntoDocument(node: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  return { container, root };
}

describe("Page background gradient behavior", () => {
  it("App shell content surface is transparent (does not use bg-background)", async () => {
    const { container, root } = renderIntoDocument(
      <SidebarInset>
        <div data-test="content">content</div>
      </SidebarInset>
    );

    await act(async () => {
      // Render once to mount
      root.render(
        <SidebarInset>
          <div data-test="content">content</div>
        </SidebarInset>
      );
      await Promise.resolve();
    });

    const inset = container.querySelector('[data-slot="sidebar-inset"]') as HTMLElement | null;
    expect(inset).toBeTruthy();
    const className = inset?.getAttribute("class") || "";

    // This is the critical assertion: the page surface should NOT be painting a solid background
    expect(className).not.toContain("bg-background");
    expect(className).not.toContain("bg-white");
  });

  it("Unauthenticated/landing wrapper does not set a solid background", async () => {
    const { container, root } = renderIntoDocument(
      <ClientLayoutShell>
        <div>Landing Child</div>
      </ClientLayoutShell>
    );

    await act(async () => {
      root.render(
        <ClientLayoutShell>
          <div>Landing Child</div>
        </ClientLayoutShell>
      );
      await Promise.resolve();
    });

    // The top-level wrapper should be the min-h-screen div from ClientLayoutShell
    const wrapper = container.querySelector("div.min-h-screen") as HTMLDivElement | null;
    expect(wrapper).toBeTruthy();

    const className = wrapper?.getAttribute("class") || "";
    expect(className).toContain("min-h-screen");
    // Should not forcibly paint a solid background; lets the body (global) background show through
    expect(className).not.toContain("bg-white");
    expect(className).not.toContain("bg-background");
  });
});
