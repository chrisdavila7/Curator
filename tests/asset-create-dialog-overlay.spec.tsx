import { describe, it, expect, vi, beforeEach } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";

import AssetCreateDialog from "@/components/asset/asset-create-dialog";

// Mock overlay provider to capture open() calls
vi.mock("@/components/lottie/overlay-provider", () => {
  const open = vi.fn();
  const close = vi.fn();
  const closeWith = vi.fn();
  return {
    __esModule: true,
    useLottieOverlay: () => ({
      isOpen: false,
      animationData: null,
      spinner: false,
      loop: false,
      autoplay: true,
      speed: undefined,
      version: 0,
      open,
      close,
      closeWith,
    }),
    // No-op provider for any accidental usage
    LottieOverlayProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    __openMock: open,
  };
});

// Mock global loading provider hook to just pass through the promise
vi.mock("@/components/loading/loading-provider", async () => {
  const actual = await vi.importActual<typeof import("@/components/loading/loading-provider")>(
    "@/components/loading/loading-provider"
  );
  return {
    __esModule: true,
    ...actual,
    useGlobalLoading: () => ({
      withGlobalLoading: <T,>(p: Promise<T>) => p,
    }),
    GlobalLoadingProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

// Optional: MSAL hook is imported but not used in mock mode; provide a stub
vi.mock("@azure/msal-react", () => ({
  useMsal: () => ({
    instance: {
      getActiveAccount: () => null,
      acquireTokenSilent: vi.fn(),
    },
    accounts: [],
  }),
}));

// Make sure we run in mock inventory mode to skip auth
beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
  process.env.USE_MOCK_INVENTORY = "true";

  // Mock fetch to return OK
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({}),
    }) as unknown as typeof fetch
  );
});

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

async function fillRequiredFields(container: HTMLElement) {
  const setVal = (selector: string, value: string) => {
    const el = container.querySelector(selector) as HTMLInputElement | null;
    expect(el).toBeTruthy();
    if (el) {
      el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
  };
  setVal("#asset", "123");
  setVal("#model", "Model X");
  setVal("#serial", "SN-001");
  setVal("#userloc", "User A");
}

async function submitForm(container: HTMLElement) {
  const submitBtn = container.querySelector('button[type="submit"]') as HTMLButtonElement | null;
  expect(submitBtn).toBeTruthy();
  await act(async () => {
    submitBtn?.click();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("AssetCreateDialog Lottie overlay on Create", () => {
  it("plays Ready to Deploy animation when status is ready_to_deploy", async () => {
    const onOpenChange = vi.fn();
    const { container } = await renderIntoDocument(
      <AssetCreateDialog open={true} onOpenChange={onOpenChange} />
    );

    await fillRequiredFields(container);

    // Status is default: ready_to_deploy. Submit
    await submitForm(container);

    // Inspect overlay mock
    type OverlayMockModule = { __openMock: ReturnType<typeof vi.fn> };
    const mod = (await import("@/components/lottie/overlay-provider")) as unknown as OverlayMockModule;
    const openMock = mod.__openMock;
    expect(openMock).toBeTruthy();
    expect(openMock).toHaveBeenCalledTimes(1);
    const arg = openMock.mock.calls[0][0];
    expect(arg.url).toBe("/animations/createreadytodeploy.json");
    expect(arg.loop).toBe(false);
    // Dialog should be instructed to close
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("plays Deployed animation when status is deployed", async () => {
    const onOpenChange = vi.fn();
    const { container } = await renderIntoDocument(
      <AssetCreateDialog open={true} onOpenChange={onOpenChange} />
    );

    await fillRequiredFields(container);

    // Switch status to Deployed
    const deployedBtn = container.querySelector('[data-testid="status-deployed"]') as HTMLButtonElement | null;
    expect(deployedBtn).toBeTruthy();
    await act(async () => {
      deployedBtn?.click();
      await Promise.resolve();
    });

    await submitForm(container);

    type OverlayMockModule = { __openMock: ReturnType<typeof vi.fn> };
    const mod = (await import("@/components/lottie/overlay-provider")) as unknown as OverlayMockModule;
    const openMock = mod.__openMock;
    expect(openMock).toHaveBeenCalledTimes(1);
    const arg = openMock.mock.calls[0][0];
    expect(arg.url).toBe("/animations/createdeployed.json");
    expect(arg.loop).toBe(false);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("plays Retired animation when status is retired", async () => {
    const onOpenChange = vi.fn();
    const { container } = await renderIntoDocument(
      <AssetCreateDialog open={true} onOpenChange={onOpenChange} />
    );

    await fillRequiredFields(container);

    // Switch status to Retired
    const retiredBtn = container.querySelector('[data-testid="status-retired"]') as HTMLButtonElement | null;
    expect(retiredBtn).toBeTruthy();
    await act(async () => {
      retiredBtn?.click();
      await Promise.resolve();
    });

    await submitForm(container);

    type OverlayMockModule = { __openMock: ReturnType<typeof vi.fn> };
    const mod = (await import("@/components/lottie/overlay-provider")) as unknown as OverlayMockModule;
    const openMock = mod.__openMock;
    expect(openMock).toHaveBeenCalledTimes(1);
    const arg = openMock.mock.calls[0][0];
    expect(arg.url).toBe("/animations/createretired.json");
    expect(arg.loop).toBe(false);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
