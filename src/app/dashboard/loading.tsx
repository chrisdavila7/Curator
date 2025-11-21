import React from "react";
import { LottieInlineLoader } from "@/components/ui/lottie-inline-loader";

export default function Loading() {
  return (
    <div className="flex min-h-48 items-center justify-center py-8" aria-live="polite">
      <LottieInlineLoader label="Loading dashboard…" size="md" />
    </div>
  );
}
