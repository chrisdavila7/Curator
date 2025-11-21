"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { LottieInlineLoader } from "@/components/ui/lottie-inline-loader";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bytes: Uint8Array | null;
  title?: string;
  filename?: string;
  loading?: boolean;
  // Optional multi-PDF pagination controls
  total?: number;
  index?: number;
  onPrev?: () => void;
  onNext?: () => void;
};

/**
 * Renders a modal dialog preview of a flattened PDF.
 * - Creates a blob URL from bytes, embeds via <iframe>
 * - Exposes Print and Download actions
 */
export function PdfPreviewDialog({
  open,
  onOpenChange,
  bytes,
  title = "Preview",
  filename = "hand-receipt.pdf",
  loading = false,
  total,
  index,
  onPrev,
  onNext,
}: Props) {
  const [url, setUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!bytes) {
      setUrl(null);
      return;
    }
    const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const blob = new Blob([ab], { type: "application/pdf" });
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => {
      URL.revokeObjectURL(u);
    };
  }, [bytes]);


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-none sm:max-w-none w-[83vw] h-[80vh] px-4">
        {(typeof total === "number" && total > 1) && (
          <>
            <button
              type="button"
              aria-label="Previous PDF"
              onClick={onPrev}
              disabled={!onPrev || (typeof index === "number" && index <= 0)}
              className="absolute top-4 right-20 rounded-xs opacity-70 transition-opacity hover:opacity-100 disabled:opacity-40 disabled:cursor-not-allowed z-50 [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
            >
              <ChevronLeft />
            </button>
            <button
              type="button"
              aria-label="Next PDF"
              onClick={onNext}
              disabled={
                !onNext ||
                (typeof index === "number" &&
                  typeof total === "number" &&
                  index >= total - 1)
              }
              className="absolute top-4 right-12 rounded-xs opacity-70 transition-opacity hover:opacity-100 disabled:opacity-40 disabled:cursor-not-allowed z-50 [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
            >
              <ChevronRight />
            </button>
          </>
        )}
        <div className="flex flex-col h-full">
          <DialogHeader className="px-4">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>PDF preview</DialogDescription>
          </DialogHeader>
          <div className="relative w-full flex-1 border rounded-md overflow-hidden mt-2">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center">
                <LottieInlineLoader label="Generating PDF…" size="md" />
              </div>
            ) : url ? (
              <iframe
                title="PDF preview"
                src={url}
                className="w-full h-full"
                style={{ border: "none" }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">
                No PDF to preview
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
