import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";

vi.mock("@/components/lottie/lottie-player", () => {
  const LottieMock = ({ "data-testid": dataTestId }: { "data-testid"?: string }) => {
    return React.createElement("div", { "data-testid": dataTestId ?? "mock-inline-lottie" });
  };
  return {
    __esModule: true,
    default: LottieMock,
  };
});

vi.mock("@/components/ui/spinner", () => {
  const SpinnerMock = (props: { "data-testid"?: string }) => {
    return React.createElement("div", { "data-testid": props["data-testid"] ?? "mock-inline-spinner" });
  };
  return {
    __esModule: true,
    Spinner: SpinnerMock,
  };
});

import { LottieInlineLoader } from "@/components/ui/lottie-inline-loader";

const renderIntoDom = (element: React.ReactElement) => {
  const container = document.createElement("div");
  document.body.innerHTML = "";
  document.body.appendChild(container);
  const root = createRoot(container);
  return { container, root, element };
};

describe("LottieInlineLoader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = "";
  });

  it("renders with the default label when none is provided", async () => {
    const { container, root, element } = renderIntoDom(<LottieInlineLoader />);

    await act(async () => {
      root.render(element);
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Loading");
  });

  it("uses a custom label when provided", async () => {
    const label = "Loading dashboard…";
    const { container, root, element } = renderIntoDom(
      <LottieInlineLoader label={label} />
    );

    await act(async () => {
      root.render(element);
      await Promise.resolve();
    });

    expect(container.textContent).toContain(label);
  });

  it("can hide the label when label is null", async () => {
    const { container, root, element } = renderIntoDom(
      <LottieInlineLoader label={null} />
    );

    await act(async () => {
      root.render(element);
      await Promise.resolve();
    });

    expect(container.textContent).toBe("");
  });

  it("fetches the loading animation JSON from the expected path", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValue({ ok: true, json: async () => ({}) } as Response);

    const { root, element } = renderIntoDom(<LottieInlineLoader />);

    await act(async () => {
      root.render(element);
      await Promise.resolve();
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/animations/loadinganimation.json",
      expect.objectContaining({ cache: "force-cache" })
    );

    fetchSpy.mockRestore();
  });
});
