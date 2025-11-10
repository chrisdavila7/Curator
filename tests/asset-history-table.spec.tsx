import { describe, it, expect } from "vitest";
import * as React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { AssetHistoryTable } from "@/components/asset/asset-history-table";
import type { AssetHistoryEvent } from "@/types/history";

function renderIntoDocument(node: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  return { container, root };
}

describe("AssetHistoryTable", () => {
  it('renders "No modifications detected" when events is empty', async () => {
    const { container, root } = renderIntoDocument(<div />);

    await act(async () => {
      root.render(<AssetHistoryTable events={[]} />);
      await Promise.resolve();
    });

    const text = container.textContent || "";
    expect(text).toContain("No modifications detected");

    // No pagination controls should be rendered for empty state
    const prev = container.querySelector('button[aria-label="Previous page"]');
    const next = container.querySelector('button[aria-label="Next page"]');
    expect(prev).toBeNull();
    expect(next).toBeNull();
  });

  it("renders pagination when more than one page of events", async () => {
    const mk = (i: number): AssetHistoryEvent => ({
      field: "model",
      changeType: "changed",
      from: `Model-${i}`,
      to: `Model-${i + 1}`,
      by: "Tester",
      at: new Date(2025, 7, 20, 12, i).toISOString(),
    });

    // 6 events with default pageSize=5 -> 2 pages
    const events: AssetHistoryEvent[] = Array.from({ length: 6 }, (_, i) => mk(i));

    const { container, root } = renderIntoDocument(<div />);

    await act(async () => {
      root.render(<AssetHistoryTable events={events} />);
      await Promise.resolve();
    });

    const next = container.querySelector('button[aria-label="Next page"]');
    const prev = container.querySelector('button[aria-label="Previous page"]');
    expect(next).toBeTruthy();
    expect(prev).toBeTruthy();
  });
});
