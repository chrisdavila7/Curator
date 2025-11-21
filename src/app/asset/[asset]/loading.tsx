"use client";

import * as React from "react";
import { useLottieOverlay } from "@/components/lottie/overlay-provider";
import { LOADING_ANIMATION_PATH } from "@/components/loading/loading-constants";

export default function Loading() {
  const { open, close } = useLottieOverlay();

  React.useEffect(() => {
    let cancelled = false;

    void (async () => {
      const ok = await open({
        url: LOADING_ANIMATION_PATH,
        loop: true,
        autoplay: true,
        speed: 1.2,
      });

      if (!ok && !cancelled) {
        // If the loading animation fails, we simply allow the underlying UI
        // to remain visible without a blocking overlay.
      }
    })();

    return () => {
      cancelled = true;
      close();
    };
  }, [open, close]);

  // The overlay itself is rendered globally by <LottieOverlay /> in the layout.
  return null;
}
