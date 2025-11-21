"use client";

import * as React from "react";
import { useGlobalLoading } from "@/components/loading/loading-provider";
import { useLottieOverlay } from "@/components/lottie/overlay-provider";

export default function GlobalLoadingOverlay() {
  const { visible } = useGlobalLoading();
  const { open, close } = useLottieOverlay();

  React.useEffect(() => {
    let cancelled = false;

    if (visible) {
      void (async () => {
        const ok = await open({
          url: "/animations/loadinganimation.json",
          loop: true,
          autoplay: true,
          speed: 0.75,
        });

        if (!ok && !cancelled) {
          // If the loading animation fails to load, we simply keep the UI
          // without a Lottie overlay rather than forcing a spinner overlay.
        }
      })();
    } else {
      close();
    }

    return () => {
      cancelled = true;
    };
  }, [visible, open, close]);

  // The actual overlay UI is rendered by <LottieOverlay /> in the app layout.
  return null;
}
