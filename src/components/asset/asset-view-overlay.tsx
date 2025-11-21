"use client";

import * as React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { AssetView } from "@/components/asset/asset-view";

export type AssetViewOverlayProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset?: number | string | null;
  className?: string;
};

/**
 * Full-screen style overlay that displays the existing AssetView content.
 * Mirrors the visual treatment of the Create overlay to preserve app UX.
 */
export default function AssetViewOverlay({
  open,
  onOpenChange,
  asset,
  className,
}: AssetViewOverlayProps) {
  const assetStr = asset != null ? String(asset) : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // Mirror Create overlay container styles for consistency
        // Add outer gutters to match page paddings: 24px (p-6) on mobile, 32px (p-8) on md+
        className={cn(
          "w-full px-9 pt-[5.2rem] pb-[5.2rem]",
          "rounded-2xl border-8 border-white bg-white shadow-[inset_2px_2px_8px_rgba(0,0,0,0.1),0_10px_15px_-3px_rgb(0,0,0,0.15),_0_4px_6px_-4px_rgb(0,0,0,0.15)]",
          "max-w-[75vw] md:max-w-[75vw]",
          "max-h-[calc(100%-11.71875rem)] md:max-h-[calc(100%-15.625rem)] overflow-hidden",
          className
        )}
      >
        {/* Preserve the existing AssetView layout and behavior; reduce right pane by ~25% (7 -> 5 cols) */}
        <AssetView
          asset={assetStr}
          leftCols={7}
          rightCols={5}
          fillLeft
          isOverlay
          onCloseOverlay={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
