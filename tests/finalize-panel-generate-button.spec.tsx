import { describe, it, expect, beforeEach, vi } from "vitest";
import * as React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import FinalizePanelCard from "@/components/checkinout/finalize-panel-card";

describe("FinalizePanelCard - Generate Yubikey Hand Receipt button", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  it("renders Generate Yubikey Hand Receipt button and calls provided callback on click", async () => {
    const onGenerate = vi.fn();
    const onRemove = vi.fn();
    const onSubmit = vi.fn();

    const stagedIn: Array<{ asset: number; serial: string; model: string }> = [];
    const stagedOut: Array<{ asset: number; serial: string; model: string; from: string; to: string }> = [
      { asset: 1323, serial: "SN-1323", model: "Yubikey 5 NFC", from: "Inventory", to: "Jane Doe" },
    ];

    const root = createRoot(container);
    await act(async () => {
      root.render(
        <FinalizePanelCard
          stagedIn={stagedIn}
          stagedOut={stagedOut}
          onRemove={onRemove}
          onSubmit={onSubmit}
          submitting={false}
          onCancel={() => {}}
          submitError={undefined}
          // New prop under test
          onGenerateDocument={onGenerate}
        />
      );
      await Promise.resolve();
    });

    const buttons = Array.from(container.querySelectorAll("button")).map((b) => b.textContent?.trim());
    expect(buttons).toContain("Generate Hand Receipt");
    expect(buttons).toContain("Submit");

    // Click the generate button
    const genBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => (b.textContent || "").trim() === "Generate Hand Receipt"
    ) as HTMLButtonElement | undefined;
    expect(genBtn).toBeTruthy();

    await act(async () => {
      genBtn?.click();
      await Promise.resolve();
    });

    expect(onGenerate).toHaveBeenCalledTimes(1);
  });
});
