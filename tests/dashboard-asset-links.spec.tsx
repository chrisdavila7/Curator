import { describe, it, expect, vi } from "vitest";
import * as React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import type { InventoryItem } from "@/types/inventory";
import { DataTable } from "@/components/data-table/data-table";
import {
  inventoryColumns,
  deployedCardColumns,
  deployedCardColumnsNoModified,
} from "@/components/data-table/columns";

 // Mock next/link to render plain anchors so jsdom can query hrefs
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string | { pathname?: string } | URL;
    children: React.ReactNode;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
    const resolved =
      typeof href === "string"
        ? href
        : href instanceof URL
        ? href.toString()
        : (href && (href as { pathname?: string }).pathname) || "/";
    return (
      <a href={resolved} {...props}>
        {children}
      </a>
    );
  },
}));

function renderIntoDocument(node: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  return { container, root };
}

const sample: InventoryItem = {
  asset: 1323,
  userLocation: "HQ – Staging",
  status: "ready_to_deploy",
  serial: "SN-1323",
  model: "Model-X",
  assetImage: "/window.svg",
  notes: "",
  modified: "2025-08-19",
  modifiedBy: "Tester",
  created: "2025-08-01",
  createdBy: "Procurement",
};

describe("Dashboard asset links", () => {
  it("renders Asset cell as a link in inventoryColumns", async () => {
    const { container, root } = renderIntoDocument(
      <DataTable columns={inventoryColumns} data={[sample]} showPagination={false} />
    );

    await act(async () => {
      root.render(
        <DataTable columns={inventoryColumns} data={[sample]} showPagination={false} />
      );
      await Promise.resolve();
    });

    const anchor = container.querySelector('a[href="/asset/1323"]');
    expect(anchor).toBeTruthy();
    expect(anchor?.textContent).toContain("1323");
  });

  it("renders Asset cell as a link in deployedCardColumns", async () => {
    const { container, root } = renderIntoDocument(
      <DataTable columns={deployedCardColumns} data={[sample]} showPagination={false} compact />
    );

    await act(async () => {
      root.render(
        <DataTable columns={deployedCardColumns} data={[sample]} showPagination={false} compact />
      );
      await Promise.resolve();
    });

    const anchor = container.querySelector('a[href="/asset/1323"]');
    expect(anchor).toBeTruthy();
    expect(anchor?.textContent).toContain("1323");
  });

  it("renders Asset cell as a link in deployedCardColumnsNoModified", async () => {
    const { container, root } = renderIntoDocument(
      <DataTable columns={deployedCardColumnsNoModified} data={[sample]} showPagination={false} compact />
    );

    await act(async () => {
      root.render(
        <DataTable columns={deployedCardColumnsNoModified} data={[sample]} showPagination={false} compact />
      );
      await Promise.resolve();
    });

    const anchor = container.querySelector('a[href="/asset/1323"]');
    expect(anchor).toBeTruthy();
    expect(anchor?.textContent).toContain("1323");
  });
});
