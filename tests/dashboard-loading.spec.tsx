import React from "react";
import { describe, it, expect, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";

vi.mock("@/components/ui/lottie-inline-loader", () => {
  const MockInline = ({ "data-testid": dataTestId }: { "data-testid"?: string }) => {
    return React.createElement("div", { "data-testid": dataTestId ?? "dashboard-inline-loader" });
  };

  return {
    __esModule: true,
    LottieInlineLoader: MockInline,
  };
});

import Loading from "@/app/dashboard/loading";

const renderIntoDom = (element: React.ReactElement) => {
  const container = document.createElement("div");
  document.body.innerHTML = "";
  document.body.appendChild(container);
  const root = createRoot(container);
  return { container, root, element };
};

describe("Dashboard route loading", () => {
  it("renders the LottieInlineLoader for dashboard loading state", async () => {
    const { container, root, element } = renderIntoDom(<Loading />);

    await act(async () => {
      root.render(element);
      await Promise.resolve();
    });

    const marker = container.querySelector("[data-testid='dashboard-inline-loader']");
    expect(marker).not.toBeNull();
  });
});
