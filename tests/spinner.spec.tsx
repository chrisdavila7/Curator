import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";

vi.mock("@/components/lottie/lottie-player", () => {
  const MockLottie = ({ "data-testid": dataTestId }: { "data-testid"?: string }) => {
    return React.createElement("div", { "data-testid": dataTestId ?? "mock-spinner-lottie" });
  };

  return {
    __esModule: true,
    default: MockLottie,
  };
});

import { Spinner } from "@/components/ui/spinner";

const renderIntoDom = (element: React.ReactElement) => {
  const container = document.createElement("div");
  document.body.innerHTML = "";
  document.body.appendChild(container);
  const root = createRoot(container);
  return { container, root, element };
};

describe("Spinner (Lottie-backed)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = "";

    const globalWithFetch = globalThis as unknown as {
      fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<{ ok: boolean; json: () => Promise<object> }>;
    };

    globalWithFetch.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({}),
    }));
  });

  it("renders an accessible status element", async () => {
    const { container, root, element } = renderIntoDom(<Spinner aria-label="Loading data" />);

    await act(async () => {
      root.render(element);
      await Promise.resolve();
    });

    const status = container.querySelector("[role='status']");
    expect(status).not.toBeNull();
  });

  it("renders a Lottie-backed visual indicator when available", async () => {
    const { container, root, element } = renderIntoDom(<Spinner />);

    await act(async () => {
      root.render(element);
      await Promise.resolve();
    });

    const lottie = container.querySelector("[data-testid='mock-spinner-lottie']");
    expect(lottie).not.toBeNull();
  });

  it("fetches the loading animation JSON from the expected path", async () => {
    const { root, element } = renderIntoDom(<Spinner />);

    await act(async () => {
      root.render(element);
      await Promise.resolve();
    });

    const globalWithFetch = globalThis as unknown as { fetch: ReturnType<typeof vi.fn> };
    expect(globalWithFetch.fetch).toHaveBeenCalledWith(
      "/animations/loadinganimation.json",
      expect.objectContaining({ cache: "force-cache" })
    );
  });
});
