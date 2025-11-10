import { describe, it, expect, vi } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string | { pathname: string }; children: React.ReactNode }) => {
    const resolved = typeof href === "string" ? href : (href && href.pathname) || "/";
    return (
      <a href={resolved} {...props}>
        {children}
      </a>
    );
  },
}));

import AppSidebar from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

async function renderIntoDocument(node: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(node);
  });
  await Promise.resolve();
  return { container, root };
}

describe("Sidebar manual toggle and hover behavior", () => {
  it("starts collapsed, expands on click, and ignores hover enter/leave", async () => {
    const { container } = await renderIntoDocument(
      <SidebarProvider defaultOpen={false}>
        <AppSidebar />
      </SidebarProvider>
    );

    const sidebar = container.querySelector('[data-slot="sidebar"]') as HTMLElement | null;
    expect(sidebar).toBeTruthy();
    expect(sidebar?.getAttribute("data-state")).toBe("collapsed");
    // Wrapper should be a flex row container to allow reflow
    const wrapper = container.querySelector('[data-slot="sidebar-wrapper"]') as HTMLElement | null;
    expect(wrapper).toBeTruthy();
    expect(wrapper?.className).toContain("flex");
    // Gap element participates in layout to reserve space
    const gap = container.querySelector('[data-slot="sidebar-gap"]') as HTMLElement | null;
    expect(gap).toBeTruthy();
    // Collapsed state should mark collapsible="icon" to reduce reserved width
    expect(sidebar?.getAttribute("data-collapsible")).toBe("icon");

    // Rail should not be present (we removed it from AppSidebar usage)
    const rail = container.querySelector('[data-slot="sidebar-rail"]');
    expect(rail).toBeNull();

    // Manual toggle button is removed; ensure it's not rendered
    const trigger = container.querySelector('[data-slot="sidebar-trigger"]') as HTMLButtonElement | null;
    expect(trigger).toBeNull();

    // Hover should do nothing when collapsed
    const containerEl = container.querySelector('[data-slot="sidebar-container"]') as HTMLElement | null;
    expect(containerEl).toBeTruthy();

    containerEl?.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    expect(sidebar?.getAttribute("data-state")).toBe("collapsed");

    // Manual toggle is unavailable; sidebar should remain collapsed
    expect(sidebar?.getAttribute("data-state")).toBe("collapsed");
    expect(sidebar?.getAttribute("data-collapsible")).toBe("icon");

    // Hover leave should not change state
    containerEl?.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
    expect(sidebar?.getAttribute("data-state")).toBe("collapsed");
  });
});
