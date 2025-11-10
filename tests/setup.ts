/**
 * Vitest setup file.
 * - Forces mock mode for API route tests.
 * - Keeps environment predictable.
 */

process.env.USE_MOCK_INVENTORY = process.env.USE_MOCK_INVENTORY || "true";

// Prefer UTC-like behavior; helpers use UTC methods so this is mostly a safeguard.
process.env.TZ = process.env.TZ || "UTC";

// jsdom does not implement matchMedia; SidebarProvider relies on it via useIsMobile.
if (typeof window !== "undefined") {
  const needsPolyfill = typeof (window as { matchMedia?: unknown }).matchMedia !== "function";
  if (needsPolyfill) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        // Legacy API used by some libs
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }
}

// React act() support: tell React DOM we're in a test environment.
// See https://react.dev/reference/react/act#test-environment
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
