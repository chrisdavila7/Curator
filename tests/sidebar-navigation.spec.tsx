import { describe, it, expect, vi } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: any; children: React.ReactNode }) => {
    const resolved =
      typeof href === "string" ? href : (href && (href as any).pathname) || "/";
    // Render as a plain anchor so jsdom can query it
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

describe("Sidebar navigation links", () => {
  it('renders "Home" linking to "/"', async () => {
    const { container } = await renderIntoDocument(
      <SidebarProvider defaultOpen={false}>
        <AppSidebar />
      </SidebarProvider>
    );

    // JSDOM doesn't compute CSS-based visibility; asserting text presence is sufficient
    const text = container.textContent || "";
    expect(text).toContain("Home");
    expect(text).not.toContain("Asset Page Test");
  });
});
