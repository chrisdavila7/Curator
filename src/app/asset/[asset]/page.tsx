"use client";

import * as React from "react";
import AssetViewOverlay from "@/components/asset/asset-view-overlay";
import { useRouter } from "next/navigation";

export default function AssetPage({
  params,
}: {
  params: Promise<{ asset: string }>;
}) {
  const [resolvedParams, setResolvedParams] = React.useState<{ asset: string } | null>(null);
  const [open, setOpen] = React.useState(true);
  const router = useRouter();

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const value = await params;
        if (!cancelled) {
          setResolvedParams(value);
        }
      } catch {
        if (!cancelled) {
          setResolvedParams({ asset: "" });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params]);

  const handleClose = React.useCallback(() => {
    const historyLength = window.history.length;
    if (historyLength > 1) {
      router.back();
      return;
    }
    router.push("/dashboard");
  }, [router]);

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (!nextOpen) {
        handleClose();
      }
    },
    [handleClose]
  );

  const asset = resolvedParams?.asset ?? "";

  return (
    <AssetViewOverlay
      open={open}
      onOpenChange={handleOpenChange}
      asset={asset}
    />
  );
}
