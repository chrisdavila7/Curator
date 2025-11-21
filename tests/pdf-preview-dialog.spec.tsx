import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";

vi.mock("@/components/ui/lottie-inline-loader", () => {
  const MockLoader = ({ label }: { label?: string }) => {
    return React.createElement(
      "div",
      {
        "data-testid": "pdf-loading-inline-loader",
      },
      label ?? ""
    );
  };

  return {
    __esModule: true,
    LottieInlineLoader: MockLoader,
  };
});

import { PdfPreviewDialog } from "@/components/templates/pdf-preview-dialog";

const renderIntoDom = (element: React.ReactElement) => {
  const container = document.createElement("div");
  document.body.innerHTML = "";
  document.body.appendChild(container);
  const root = createRoot(container);
  return { container, root, element };
};

describe("PdfPreviewDialog loading behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = "";

    const globalWithUrl = globalThis as unknown as {
      URL?: {
        createObjectURL: (blob: Blob) => string;
        revokeObjectURL: (url: string) => void;
      };
    };

    globalWithUrl.URL = {
      createObjectURL: vi.fn(() => "blob:mock-url"),
      revokeObjectURL: vi.fn(),
    };
  });

  it("shows the Lottie-based inline loader when loading", async () => {
    const { root, element } = renderIntoDom(
      <PdfPreviewDialog
        open
        onOpenChange={() => {}}
        bytes={null}
        loading
        title="Preview"
      />
    );

    await act(async () => {
      root.render(element);
      await Promise.resolve();
    });

    const loader = document.querySelector("[data-testid='pdf-loading-inline-loader']");
    expect(loader).not.toBeNull();
  });

  it("renders the PDF iframe when bytes are present and not loading", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const { root, element } = renderIntoDom(
      <PdfPreviewDialog
        open
        onOpenChange={() => {}}
        bytes={bytes}
        loading={false}
        title="Preview"
      />
    );

    await act(async () => {
      root.render(element);
      await Promise.resolve();
    });

    const iframe = document.querySelector("iframe[title='PDF preview']") as HTMLIFrameElement | null;
    expect(iframe).not.toBeNull();
  });
});
