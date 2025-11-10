"use client";

import { useEffect, useState } from "react";

/**
 * Returns true on small screens (default <= 768px).
 * Used by the shadcn Sidebar to determine mobile behavior.
 */
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      // Default to desktop in non-browser or test environments
      setIsMobile(false);
      return;
    }

    const media = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const onChange = () => setIsMobile(media.matches);

    // Initialize immediately
    onChange();

    // Add listener (both modern and legacy)
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    } else if ("addListener" in media) {
      const legacy = media as MediaQueryList & {
        addListener?: (listener: (this: MediaQueryList, ev: MediaQueryListEvent) => void) => void;
        removeListener?: (listener: (this: MediaQueryList, ev: MediaQueryListEvent) => void) => void;
      };
      if (typeof legacy.addListener === "function" && typeof legacy.removeListener === "function") {
        const legacyHandler = () => onChange();
        legacy.addListener(legacyHandler);
        return () => legacy.removeListener(legacyHandler);
      }
      return () => {};
    } else {
      return () => {};
    }
  }, [breakpoint]);

  return isMobile;
}
