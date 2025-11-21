"use client";

import * as React from "react";
import { useMsal } from "@azure/msal-react";
import type { AuthenticationResult, AccountInfo } from "@azure/msal-browser";
import type { InventoryItem } from "@/types/inventory";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AssetDetailsTable } from "@/components/asset/asset-details-table";
import UserLocationSelect from "@/components/user-location-select";
import FinalizePanelCard from "@/components/checkinout/finalize-panel-card";
import CheckInOutTabs from "@/components/checkinout/checkinout-tabs";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast-provider";
import { useLottieOverlay } from "@/components/lottie/overlay-provider";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useGlobalLoading } from "@/components/loading/loading-provider";
import PageHeader from "@/components/page-header";
import { orchestrateHandReceipts } from "@/lib/pdf/orchestrate-hand-receipts";
import { PdfPreviewDialog } from "@/components/templates/pdf-preview-dialog";

const isMock =
  process.env.NEXT_PUBLIC_USE_MOCK_INVENTORY === "true" ||
  process.env.USE_MOCK_INVENTORY === "true";

const API_SCOPE =
  process.env.NEXT_PUBLIC_AZURE_API_SCOPE ||
  process.env.AZURE_API_SCOPE ||
  "";

/**
 * New page: /check-in-out
 * Layout mirrors provided mock with a single staging card.
 * - Title h3 "Stage"
 * - Paragraph "Enter Assets to Check In/Out"
 * - Asset input; validates against SharePoint via /api/inventory/[asset]
 * - Table (reused AssetDetailsTable) fills after valid lookup
 * - User/Location selector (reused behavior from Create)
 * - Switch "Check In" / "Check Out" (function pending)
 * - "Stage" button (function pending)
 */
export default function CheckInOutPage() {
  const { instance, accounts } = useMsal();
  const { toast } = useToast();
  const { open } = useLottieOverlay();
  const activeAccount = React.useMemo<AccountInfo | null>(() => {
    return instance.getActiveAccount() || accounts[0] || null;
  }, [instance, accounts]);
  const { withGlobalLoading } = useGlobalLoading();

  const stageRef = React.useRef<HTMLDivElement>(null);
  const [finalizeHeight, setFinalizeHeight] = React.useState<number | null>(null);

  React.useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => setFinalizeHeight(el.offsetHeight);
    update();
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, []);


  const [assetInput, setAssetInput] = React.useState("");
  const [assetError, setAssetError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [item, setItem] = React.useState<InventoryItem | null>(null);

  const [userLocation, setUserLocation] = React.useState("");
  const [isCheckout, setIsCheckout] = React.useState(true); // default to "Check Out" as in mock



  // Measure the height of the action box (User/Location + Stage) in Check Out state
  const actionBoxRef = React.useRef<HTMLDivElement>(null);
  const [checkoutBoxHeight, setCheckoutBoxHeight] = React.useState<number | null>(null);
  React.useEffect(() => {
    const el = actionBoxRef.current;
    if (!el) return;
    const update = () => {
      if (isCheckout) setCheckoutBoxHeight(el.offsetHeight);
    };
    update();
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => ro.disconnect();
  }, [isCheckout]);

  // Finalize counts and staged items (Check In)
  const [inCount, setInCount] = React.useState(0);
  const [outCount, setOutCount] = React.useState(0); // reserved for future "Check Out" staging
  const [stagedIn, setStagedIn] = React.useState<Array<Pick<InventoryItem, "asset" | "serial" | "model">>>([]);
  const [stagedOut, setStagedOut] = React.useState<Array<Pick<InventoryItem, "asset" | "serial" | "model"> & { from: string; to: string }>>([]);
  const [stageError, setStageError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewBytes, setPreviewBytes] = React.useState<Uint8Array | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [previewQueue, setPreviewQueue] = React.useState<Uint8Array[]>([]);
  const [queueIndex, setQueueIndex] = React.useState(0);
  const [autoSubmitAfterPreview, setAutoSubmitAfterPreview] = React.useState(false);

  // Overlay variant URLs (env overrides)
  const CHECKIN_OVERLAY_URL =
    process.env.NEXT_PUBLIC_CHECKIN_OVERLAY_URL || "/animations/checkinanimation.json";
  const CHECKINOUT_OVERLAY_URL =
    process.env.NEXT_PUBLIC_CHECKINOUT_OVERLAY_URL || "/animations/checkinoutanimation.json";
  const CHECKOUT_OVERLAY_URL =
    process.env.NEXT_PUBLIC_CHECKOUT_OVERLAY_URL || "/animations/checkoutanimation.json";

  // Future-ready: branch on different conditions to select different overlays
  const resolveFinalizeOverlayUrl = React.useCallback(
    (inCnt: number, outCnt: number): string | null => {
      // Precedence: both >= 1 -> check-in-out; else check-in only; else check-out only
      if (inCnt >= 1 && outCnt >= 1) return CHECKINOUT_OVERLAY_URL;
      if (inCnt >= 1 && outCnt === 0) return CHECKIN_OVERLAY_URL;
      if (outCnt >= 1 && inCnt === 0) return CHECKOUT_OVERLAY_URL;
      return null;
    },
    [CHECKINOUT_OVERLAY_URL, CHECKIN_OVERLAY_URL, CHECKOUT_OVERLAY_URL]
  );


  async function getAuthHeaders(): Promise<HeadersInit> {
    if (isMock) return {};
    if (!API_SCOPE) {
      throw new Error("Missing API scope. Set NEXT_PUBLIC_AZURE_API_SCOPE or AZURE_API_SCOPE.");
    }
    const account = activeAccount || instance.getActiveAccount() || null;
    if (!account) {
      throw new Error("Sign in required");
    }
    const acquireSilentWithTimeout = async (timeoutMs = 10000): Promise<AuthenticationResult> => {
      const p = instance.acquireTokenSilent({
        scopes: [API_SCOPE],
        account,
      });
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("acquireTokenSilent timeout")), timeoutMs)
      );
      return (await Promise.race([p, timeout])) as AuthenticationResult;
    };
    const result = await acquireSilentWithTimeout(10000);
    return { Authorization: `Bearer ${result.accessToken}` };
  }

  React.useEffect(() => {
    const trimmed = assetInput.trim();

    // When empty, reset state and stop loading
    if (!trimmed) {
      setAssetError(null);
      setItem(null);
      setLoading(false);
      return;
    }

    // Validate numeric input
    const assetNum = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(assetNum)) {
      setAssetError("Enter a valid asset number");
      setItem(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    // Debounce lookup for snappy UX while typing
    const timer = setTimeout(async () => {
      setAssetError(null);
      setLoading(true);
      setItem(null); // show skeleton while loading

      try {
        const headers = await getAuthHeaders().catch((e) => {
          throw new Error(e instanceof Error ? e.message : "Auth error");
        });
        const res = await fetch(`/api/inventory/${assetNum}`, {
          method: "GET",
          headers,
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) {
          if (!cancelled) {
            setAssetError(res.status === 404 ? "Asset not found in SharePoint list" : `Lookup failed (${res.status})`);
            setItem(null);
          }
          return;
        }
        const data = (await res.json()) as InventoryItem;
        if (!cancelled) setItem(data);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (!cancelled) setAssetError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [assetInput, instance, activeAccount]);

  // Clear any stage error when inputs change
  React.useEffect(() => {
    setStageError(null);
  }, [assetInput, isCheckout, userLocation]);

  const handleRemove = React.useCallback((kind: "in" | "out", asset: number) => {
    if (kind === "in") {
      setStagedIn((prev) => prev.filter((s) => s.asset !== asset));
      setInCount((n) => Math.max(0, n - 1));
    } else {
      setStagedOut((prev) => prev.filter((s) => s.asset !== asset));
      setOutCount((n) => Math.max(0, n - 1));
    }
  }, []);

  const handleSubmitFinalize = React.useCallback(async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const headers = await getAuthHeaders();
      const jsonHeaders: HeadersInit = {
        ...(headers as Record<string, string>),
        "Content-Type": "application/json",
      };

      const requests: Promise<Response>[] = [];

      // Apply Check Ins: status -> ready_to_deploy, userLocation -> Inventory
      for (const r of stagedIn) {
        requests.push(
          fetch(`/api/inventory/${r.asset}`, {
            method: "PATCH",
            headers: jsonHeaders,
            body: JSON.stringify({
              fields: { status: "ready_to_deploy", userLocation: "Inventory" },
            }),
            cache: "no-store",
          })
        );
      }

      // Apply Check Outs: status -> deployed, userLocation -> selected destination
      for (const r of stagedOut) {
        requests.push(
          fetch(`/api/inventory/${r.asset}`, {
            method: "PATCH",
            headers: jsonHeaders,
            body: JSON.stringify({
              fields: { status: "deployed", userLocation: r.to },
            }),
            cache: "no-store",
          })
        );
      }

      const results = await withGlobalLoading(Promise.allSettled(requests));
      const failures: string[] = [];

      for (const res of results) {
        if (res.status === "fulfilled") {
          if (!res.value.ok) {
            let msg = `HTTP ${res.value.status}`;
            try {
              const data = await res.value.json();
              if (data?.error) {
                msg = data.detail ? `${data.error}: ${data.detail}` : data.error;
              }
            } catch {
              // ignore json parse
            }
            failures.push(msg);
          }
        } else {
          failures.push(res.reason instanceof Error ? res.reason.message : "Unknown error");
        }
      }

      if (failures.length > 0) {
        setSubmitError(
          `Failed to finalize ${failures.length} item(s). ${failures.slice(0, 3).join("; ")}${
            failures.length > 3 ? " ..." : ""
          }`
        );
        return;
      }

      // All succeeded: play overlay variant or fallback toast, then clear staged data and close
      const submittedIn = stagedIn.length;
      const submittedOut = stagedOut.length;

      const overlayUrl = resolveFinalizeOverlayUrl(submittedIn, submittedOut);

      const showToast = () => {
        toast({
          title: "Submitted",
          description: `Submitted ${submittedIn} check-in(s) and ${submittedOut} check-out(s).`,
          duration: 4000,
        });
      };

      if (overlayUrl) {
        // Play overlay; fallback to toast on load failure or user dismissal (skip)
        const ok = await open({
          url: overlayUrl,
          loop: false,
          autoplay: true,
          speed: 1.2,
          onClose: (reason) => {
            if (reason === "dismissed") {
              showToast();
            }
          },
        });
        if (!ok) {
          showToast();
        }
      } else {
        showToast();
      }

      setStagedIn([]);
      setStagedOut([]);
      setInCount(0);
      setOutCount(0);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }, [stagedIn, stagedOut, getAuthHeaders, toast, open, resolveFinalizeOverlayUrl]);

  // Generate Blank Hand Receipt and show preview (multi-PDF sequencing by User/Location)
  // Sequencing handler for PdfPreviewDialog close -> advance to next queued PDF
  const handlePreviewOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) {
        if (previewQueue.length > 0 && queueIndex + 1 < previewQueue.length) {
          const next = queueIndex + 1;
          setQueueIndex(next);
          setPreviewBytes(previewQueue[next]);
          setPreviewOpen(true);
        } else {
          setPreviewQueue([]);
          setQueueIndex(0);
          setPreviewBytes(null);
          setPreviewOpen(false);
          if (autoSubmitAfterPreview) {
            setAutoSubmitAfterPreview(false);
            void (async () => {
              await handleSubmitFinalize();
            })();
          }
        }
      } else {
        setPreviewOpen(true);
      }
    },
    [previewQueue, queueIndex, autoSubmitAfterPreview, handleSubmitFinalize]
  );

  // Pagination handlers for multi-PDF preview (when dialog is open)
  const handlePrev = React.useCallback(() => {
    if (queueIndex > 0) {
      const next = queueIndex - 1;
      setQueueIndex(next);
      setPreviewBytes(previewQueue[next]);
    }
  }, [queueIndex, previewQueue]);

  const handleNext = React.useCallback(() => {
    if (queueIndex + 1 < previewQueue.length) {
      const next = queueIndex + 1;
      setQueueIndex(next);
      setPreviewBytes(previewQueue[next]);
    }
  }, [queueIndex, previewQueue]);

  // Generate Blank Hand Receipt and show preview (grouped by User/Location; up to 5 assets per PDF)
  const handleGenerateDocument = React.useCallback(async () => {
    if (stagedOut.length === 0) {
      toast({
        title: "No item staged",
        description: "Stage a Check Out item first to generate a receipt.",
        duration: 3000,
      });
      return;
    }

    // Derive current user's display name from MSAL
    const acct = activeAccount || instance.getActiveAccount() || null;
    const ctsRepName =
      (acct && (acct.name || (acct.idTokenClaims as Record<string, unknown> | undefined)?.name as string | undefined)) ||
      (acct && ((acct.idTokenClaims as Record<string, unknown> | undefined)?.preferred_username as string | undefined)) ||
      "User";

    try {
      setPreviewBytes(null);
      setPreviewLoading(true);
      setPreviewOpen(true);
      setAutoSubmitAfterPreview(true);

      const results = await orchestrateHandReceipts({
        getAuthHeaders,
        stagedOut,
        ctsRepName,
        // date defaults inside generator if omitted
        templateKey: "Blank Hand Receipt",
      });

      if (results.length > 0) {
        const queue = results.map((r) => r.bytes);
        setPreviewQueue(queue);
        setQueueIndex(0);
        setPreviewBytes(queue[0]);
      } else {
        // No results; close preview and show toast
        setPreviewOpen(false);
        toast({
          title: "No receipts generated",
          description: "No eligible items to generate receipts.",
          duration: 3000,
        });
      }

      setPreviewLoading(false);
    } catch (e) {
      setPreviewLoading(false);
      setSubmitError(e instanceof Error ? e.message : "Failed to generate receipt(s)");
    }
  }, [stagedOut, getAuthHeaders, toast, activeAccount, instance]);

  function AssetDetailsSkeleton() {
    return (
      <div className="rounded-md border w-full">
        <Table className="w-full text-sm [&_td]:py-2 [&_td]:px-3">
          <TableBody>
            <TableRow data-serial-anchor>
              <TableCell className="w-48 text-muted-foreground whitespace-nowrap">Serial</TableCell>
              <TableCell className="whitespace-nowrap">
                <Skeleton className="h-4 w-40" />
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="w-48 text-muted-foreground whitespace-nowrap">Model</TableCell>
              <TableCell className="whitespace-nowrap">
                <Skeleton className="h-4 w-48" />
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="w-48 text-muted-foreground whitespace-nowrap">Current User/Location</TableCell>
              <TableCell className="whitespace-nowrap">
                <Skeleton className="h-4 w-64" />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  }

  // Derived state for Stage button eligibility
  const isCheckIn = !isCheckout;
  const isInInventory = ((item?.userLocation ?? "")).trim() === "Inventory";
  const guardCheckIn = isCheckIn && isInInventory;
  const guardCheckOut = isCheckout && !!item && !isInInventory;
  const isStageDisabled =
    !item ||
    (isCheckout && userLocation.trim().length === 0) ||
    guardCheckIn ||
    guardCheckOut;
  const disabledReason = guardCheckIn ? "Asset is currently in Inventory" : guardCheckOut ? "Asset is currently Checked Out" : null;

  return (
    <div className="flex flex-col gap-[calc(6.4rem-30px)] min-h-screen">
      {/* Header row: title */}
      <PageHeader />

      {/* Content: Stage card (left) + Finalize panel (right) */}
      <div className="mx-auto max-w-[1600px] grid gap-8 md:grid-cols-[600px_600px] justify-items-center items-start flex-1 min-h-0">
        <div ref={stageRef} className="w-full md:w-[600px] min-h-0">
        <Card className="py-0 self-start w-full md:w-[600px] border-8 border-white bg-white shadow-[inset_2px_2px_8px_rgba(0,0,0,0.1),0_10px_15px_-3px_rgb(0,0,0,0.15),_0_4px_6px_-4px_rgb(0,0,0,0.15)]">
        <CardContent className="px-12 pt-5 pb-4 flex flex-col overflow-x-hidden overflow-y-visible min-w-0">
          {/* Header of card: Title + subtitle left, switch right */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-2xl font-semibold tracking-tight">Enter Assets to Check In/Out</h3>
            </div>

          </div>

          {/* Asset input + Mode tabs */}
          <div className="mt-4 grid w-full md:grid-cols-[1fr_auto] md:items-end md:gap-x-0 gap-2">
            <div className="grid gap-1 w-full">
              <Label htmlFor="asset-number">Asset</Label>
              <div className="relative w-full md:w-1/2">
              <Input
                id="asset-number"
                inputMode="numeric"
                placeholder="Asset Number"
                value={assetInput}
                onChange={(e) => {
                    setAssetInput(e.target.value);
                    if (assetError) setAssetError(null);
                  }}
                  aria-invalid={!!assetError}
                  className="w-full pr-9"
                />
                {loading && (
                  <span className="absolute right-[5px] top-1/2 -translate-y-1/2 m-0 p-0">
                    <Spinner size="sm" className="m-0 p-0" aria-label="Loading" />
                  </span>
                )}
              </div>
              {assetError && (
                <span className="text-sm text-destructive">{assetError}</span>
              )}
            </div>
            <CheckInOutTabs
              isCheckout={isCheckout}
              onChange={setIsCheckout}
              className="justify-self-end md:self-end"
            />
          </div>

          {/* Details table (or skeleton when empty); while loading we only show the skeleton */}
          <div className="mt-4">
            {item ? (
              <AssetDetailsTable item={item} />
            ) : (
              <AssetDetailsSkeleton />
            )}
          </div>

          {/* To User/Location + Stage button row */}
          <div
            ref={actionBoxRef}
            className="mt-4 rounded-md border p-4"
            style={!isCheckout && checkoutBoxHeight != null ? { minHeight: checkoutBoxHeight } : undefined}
          >
            <div className={`grid gap-2 md:grid-cols-[1fr_auto] ${isCheckout ? "md:items-end" : "md:items-center"} min-w-0`}>
              {isCheckout ? (
                <div className="grid gap-1 w-full min-w-0">
                  <Label htmlFor="to-userloc">To User/Location</Label>
                  <UserLocationSelect
                    id="to-userloc"
                    value={userLocation}
                    onChange={setUserLocation}
                    placeholder="Select or Enter User/Location"
                    showManualButton={false}
                    className="min-w-0"
                  />
                </div>
              ) : (
                <div className="grid gap-1 w-full self-center min-w-0">
                  <h3 className="text-sm font-semibold">To Inventory</h3>
                </div>
              )}

              <div className={`flex md:justify-end ${isStageDisabled ? "cursor-not-allowed" : ""}`}>
                {disabledReason ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="inline-block">
                        <Button
                          type="button"
                          className="mt-1 md:mt-0 px-6 disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={isStageDisabled}
                          // Function: stage item depending on mode
                          onClick={() => {
                            if (!item) return;
                            const assetNum = item.asset;
                            const inDup = stagedIn.some((s) => s.asset === assetNum);
                            const outDup = stagedOut.some((s) => s.asset === assetNum);
                            if (inDup || outDup) {
                              setStageError(`Asset ${assetNum} is already staged for ${inDup ? "Check In" : "Check Out"}.`);
                              return;
                            }
                            setStageError(null);
                            if (!isCheckout) {
                              // Check In: save key fields locally and increment top counter
                              setStagedIn((prev) => [
                                ...prev,
                                { asset: item.asset, serial: item.serial, model: item.model },
                              ]);
                              setInCount((n) => n + 1);
                              // Prepare for next scan
                              setAssetInput("");
                              setItem(null);
                              setAssetError(null);
                            } else {
                              // Check Out: save key fields + destination locally and increment bottom counter
                              setStagedOut((prev) => [
                                ...prev,
                                { asset: item.asset, serial: item.serial, model: item.model, from: item.userLocation, to: userLocation },
                              ]);
                              setOutCount((n) => n + 1);
                              // Prepare for next scan
                              setUserLocation("");
                              setAssetInput("");
                              setItem(null);
                              setAssetError(null);
                            }
                          }}
                        >
                          Stage
                        </Button>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent sideOffset={6}>{disabledReason}</TooltipContent>
                  </Tooltip>
                ) : (
                  <Button
                    type="button"
                    className="mt-1 md:mt-0 px-6 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isStageDisabled}
                    // Function: stage item depending on mode
                    onClick={() => {
                      if (!item) return;
                      const assetNum = item.asset;
                      const inDup = stagedIn.some((s) => s.asset === assetNum);
                      const outDup = stagedOut.some((s) => s.asset === assetNum);
                      if (inDup || outDup) {
                        setStageError(`Asset ${assetNum} is already staged for ${inDup ? "Check In" : "Check Out"}.`);
                        return;
                      }
                      setStageError(null);
                      if (!isCheckout) {
                        // Check In: save key fields locally and increment top counter
                        setStagedIn((prev) => [
                          ...prev,
                          { asset: item.asset, serial: item.serial, model: item.model },
                        ]);
                        setInCount((n) => n + 1);
                        // Prepare for next scan
                        setAssetInput("");
                        setItem(null);
                        setAssetError(null);
                      } else {
                        // Check Out: save key fields + destination locally and increment bottom counter
                        setStagedOut((prev) => [
                          ...prev,
                          { asset: item.asset, serial: item.serial, model: item.model, from: item.userLocation, to: userLocation },
                        ]);
                        setOutCount((n) => n + 1);
                        // Prepare for next scan
                        setUserLocation("");
                        setAssetInput("");
                        setItem(null);
                        setAssetError(null);
                      }
                    }}
                  >
                    Stage
                  </Button>
                )}
              </div>
            </div>
            {stageError && (
              <div role="alert" aria-live="polite" className="mt-2 text-sm text-destructive">
                {stageError}
              </div>
            )}
          </div>  
        </CardContent>
      </Card>
        </div>
        <div className="w-full md:w-[600px]">
          <FinalizePanelCard
            className="w-full md:w-[600px] border-8 border-white bg-white shadow-[inset_2px_2px_8px_rgba(0,0,0,0.1),0_10px_15px_-3px_rgb(0,0,0,0.15),_0_4px_6px_-4px_rgb(0,0,0,0.15)]"
            style={finalizeHeight != null ? { minHeight: finalizeHeight } : undefined}
            stagedIn={stagedIn}
            stagedOut={stagedOut}
            onRemove={handleRemove}
            onSubmit={handleSubmitFinalize}
            submitting={submitting}
            submitError={submitError ?? undefined}
            onGenerateDocument={handleGenerateDocument}
          />
        </div>
        <PdfPreviewDialog
          open={previewOpen}
          onOpenChange={handlePreviewOpenChange}
          bytes={previewBytes}
          title="Hand Receipt Preview"
          filename="hand-receipt.pdf"
          loading={previewLoading}
          total={previewQueue.length}
          index={queueIndex}
          onPrev={handlePrev}
          onNext={handleNext}
        />
      </div>
    </div>
  );
}
