"use client";

import * as React from "react";
import { useMsal } from "@azure/msal-react";
import type { AccountInfo, AuthenticationResult } from "@azure/msal-browser";
import type { InventoryItem, InventoryStatus } from "@/types/inventory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ButtonGroup } from "@/components/ui/button-group";
import { AssetDetailsTable } from "@/components/asset/asset-details-table";
import { AssetHistoryTable } from "@/components/asset/asset-history-table";
import type { AssetHistoryEvent } from "@/types/history";
import { cn } from "@/lib/utils";
import AssetEditSheet from "@/components/asset/asset-edit-sheet";
import { PencilSquareIcon } from "@heroicons/react/24/outline";
import UserLocationSelect from "@/components/user-location-select";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Dialog as ModalDialog,
  DialogContent as ModalDialogContent,
  DialogHeader as ModalDialogHeader,
  DialogTitle as ModalDialogTitle,
  DialogDescription as ModalDialogDescription,
  DialogFooter as ModalDialogFooter,
} from "@/components/ui/dialog";
import { useLottieOverlay } from "@/components/lottie/overlay-provider";
import { useGlobalLoading } from "@/components/loading/loading-provider";

const isMock =
  process.env.NEXT_PUBLIC_USE_MOCK_INVENTORY === "true" ||
  process.env.USE_MOCK_INVENTORY === "true";

const API_SCOPE =
  process.env.NEXT_PUBLIC_AZURE_API_SCOPE ||
  process.env.AZURE_API_SCOPE ||
  "";

type HeaderGettable = { headers: { get(name: string): (string | null) } };
function hasHeaderGet(o: unknown): o is HeaderGettable {
  if (typeof o !== "object" || o === null) return false;
  const r = o as { headers?: unknown };
  if (!r.headers || typeof r.headers !== "object") return false;
  const h = r.headers as { get?: unknown };
  return typeof h.get === "function";
}

type Span = 5 | 7;

type Props = {
  asset: string;
  initialTab?: "details" | "history";
  leftCols?: Span;
  rightCols?: Span;
  fillLeft?: boolean;
  isOverlay?: boolean;
  onCloseOverlay?: () => void;
};

export function AssetView({ asset, initialTab, leftCols = 5, rightCols = 7, fillLeft = false, isOverlay = false, onCloseOverlay }: Props) {
  const { instance, accounts } = useMsal();
  const { withGlobalLoading } = useGlobalLoading();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = React.useState(false);
  const [msalReady, setMsalReady] = React.useState(false);
  const [item, setItem] = React.useState<InventoryItem | null>(null);
  const [etag, setEtag] = React.useState<string | null>(null);
  const { open: openOverlay } = useLottieOverlay();

  // Local draft for frontend-only edits from the Edit Menu
  const [draft, setDraft] = React.useState<InventoryItem | null>(null);
  const workingItem = React.useMemo(() => draft ?? item, [draft, item]);
  const hasDraftChanges = React.useMemo(() => {
    if (!item || !draft) return false;
    return (
      draft.serial !== item.serial ||
      draft.model !== item.model ||
      draft.userLocation !== item.userLocation
    );
  }, [item, draft]);
  const [saveLoading, setSaveLoading] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const [selectedStatus, setSelectedStatus] = React.useState<InventoryStatus | null>(null);
  const hasStatusChange = React.useMemo(() => {
    if (!item) return false;
    return (selectedStatus ?? item.status) !== item.status;
  }, [selectedStatus, item]);
  const hasAnyChanges = hasDraftChanges || hasStatusChange;

  // Destination for "Deployed" status
  const [deployTo, setDeployTo] = React.useState<string>("");
  const [deployDialogOpen, setDeployDialogOpen] = React.useState(false);
  const [statusBeforePrompt, setStatusBeforePrompt] = React.useState<InventoryStatus | null>(null);
  const needDeployLocation = React.useMemo(() => {
    if (!item) return false;
    return (selectedStatus ?? item.status) === "deployed" && hasStatusChange;
  }, [selectedStatus, item, hasStatusChange]);
  const deployValid = !needDeployLocation || deployTo.trim().length > 0;
  const [activeTab, setActiveTab] = React.useState<"details" | "history">(initialTab ?? "details");
  const [historyEvents, setHistoryEvents] = React.useState<AssetHistoryEvent[] | null>(null);
  const [historyLoading, setHistoryLoading] = React.useState(false);
  const [historyError, setHistoryError] = React.useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = React.useState(false);

  const activeAccount = React.useMemo<AccountInfo | null>(() => {
    return instance.getActiveAccount() || accounts[0] || null;
  }, [instance, accounts]);

  // Ensure MSAL is initialized (mirrors InventoryView)
  React.useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    (async () => {
      try {
        await instance.initialize();
      } catch {
        // ignore init error here; loginRedirect will surface errors later
      } finally {
        if (!cancelled) setMsalReady(true);
      }
    })();

    timer = setTimeout(() => {
      if (!cancelled) setMsalReady(true);
    }, 2000);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [instance]);

  const assetNum = React.useMemo(() => {
    const v = Number.parseInt(asset, 10);
    return Number.isFinite(v) ? v : null;
  }, [asset]);

  const load = React.useCallback(async () => {
    await withGlobalLoading(
      (async () => {
        try {
          setLoading(true);
          setError(null);

          if (assetNum == null) {
            setItem(null);
            return;
          }

          let headers: HeadersInit = {};

          if (!isMock) {
            if (!API_SCOPE) {
              throw new Error("Missing API scope. Set NEXT_PUBLIC_AZURE_API_SCOPE or AZURE_API_SCOPE.");
            }
            if (!activeAccount) {
              setNeedsLogin(true);
              return;
            }

            const acquireSilentWithTimeout = async (timeoutMs = 10000): Promise<AuthenticationResult> => {
              const p = instance.acquireTokenSilent({
                scopes: [API_SCOPE],
                account: activeAccount,
              });
              const timeout = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("acquireTokenSilent timeout")), timeoutMs)
              );
              return (await Promise.race([p, timeout])) as AuthenticationResult;
            };

            try {
              const result = await acquireSilentWithTimeout(10000);
              headers = { Authorization: `Bearer ${result.accessToken}` };
            } catch {
              setNeedsLogin(true);
              return;
            }
          } else {
            // In mock mode, no auth header.
          }

          const res = await fetch(`/api/inventory/${assetNum}`, { method: "GET", headers, cache: "no-store" });
          if (res.status === 404) {
            // Asset not found
            setItem(null);
            setSelectedStatus(null);
            return;
          }
          if (!res.ok) {
            const text = await res.text();
            throw new Error(`API ${res.status}: ${text}`);
          }
          const resETag = hasHeaderGet(res)
            ? res.headers.get("ETag") || res.headers.get("Etag") || res.headers.get("etag")
            : null;
          const found = (await res.json()) as InventoryItem;

          setItem(found);
          setSelectedStatus(found.status);
          setEtag(resETag);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Unknown error");
        } finally {
          setLoading(false);
        }
      })()
    );
  }, [withGlobalLoading, assetNum, activeAccount, instance]);

  React.useEffect(() => {
    // Ensure MSAL ready first in live mode, otherwise attempt load immediately
    if (!isMock && !msalReady) return;
    void load();
  }, [load, msalReady]);

  React.useEffect(() => {
    if (!isMock && msalReady && !activeAccount) {
      setNeedsLogin(true);
      setLoading(false);
    }
  }, [isMock, msalReady, activeAccount]);

  // Fetch history when History tab becomes active. Avoids setState during render.
  React.useEffect(() => {
    if (activeTab !== "history") return;
    if (assetNum == null) return;
    if (historyEvents !== null || historyLoading) return;

    let cancelled = false;

    const fetchHistory = async () => {
      await withGlobalLoading(
        (async () => {
          try {
            setHistoryLoading(true);
            setHistoryError(null);

            let headers: HeadersInit = {};
            if (!isMock) {
              if (!API_SCOPE) {
                throw new Error("Missing API scope. Set NEXT_PUBLIC_AZURE_API_SCOPE or AZURE_API_SCOPE.");
              }
              const acct = activeAccount;
              if (!acct) {
                setNeedsLogin(true);
                return;
              }

              const acquireSilentWithTimeout = async (timeoutMs = 10000): Promise<AuthenticationResult> => {
                const p = instance.acquireTokenSilent({
                  scopes: [API_SCOPE],
                  account: acct,
                });
                const timeout = new Promise<never>((_, reject) =>
                  setTimeout(() => reject(new Error("acquireTokenSilent timeout")), timeoutMs)
                );
                return (await Promise.race([p, timeout])) as AuthenticationResult;
              };

              const res = await acquireSilentWithTimeout(10000);
              headers = { Authorization: `Bearer ${res.accessToken}` };
            }

            const res = await fetch(`/api/inventory/${assetNum}/history`, { headers, cache: "no-store" });
            if (!res.ok) {
              if (res.status === 404) {
                if (!cancelled) setHistoryEvents([]);
              } else {
                const t = await res.text();
                throw new Error(`API ${res.status}: ${t}`);
              }
            } else {
              const data = (await res.json()) as AssetHistoryEvent[];
              if (!cancelled) setHistoryEvents(Array.isArray(data) ? data : []);
            }
          } catch (e) {
            if (!cancelled) {
              setHistoryError(e instanceof Error ? e.message : "Unknown error");
              setHistoryEvents([]);
            }
          } finally {
            if (!cancelled) setHistoryLoading(false);
          }
        })()
      );
    };

    void fetchHistory();
    return () => {
      cancelled = true;
    };
  }, [activeTab, assetNum, isMock, API_SCOPE, activeAccount, instance, historyEvents, historyLoading, withGlobalLoading]);


  const handleSignIn = async () => {
    if (!API_SCOPE) {
      setError("Missing API scope. Set NEXT_PUBLIC_AZURE_API_SCOPE or AZURE_API_SCOPE.");
      return;
    }
    await instance.initialize();
    await instance.loginRedirect({ scopes: [API_SCOPE] });
  };

  // Backend updater passed to overlay to persist per-row edits
  // Frontend-only updater passed to overlay; merges delta into draft and returns the new draft
  const onUpdate = React.useCallback(
    async (delta: Partial<Pick<InventoryItem, "serial" | "model" | "userLocation">>) => {
      const base = draft ?? item;
      if (!base) {
        return { item: undefined };
      }
      const next = { ...base, ...delta };
      setDraft(next);
      return { item: next };
    },
    [draft, item]
  );

  const handleSave = React.useCallback(async () => {
    if (!item) return;
    if (assetNum == null) throw new Error("Invalid asset");
    const prevStatus = item.status as InventoryStatus;

    const delta: Partial<Pick<InventoryItem, "serial" | "model" | "userLocation" | "status">> = {};

    // Edit-sheet changes
    if (draft && draft.serial !== item.serial) delta.serial = draft.serial;
    if (draft && draft.model !== item.model) delta.model = draft.model;
    if (draft && draft.userLocation !== item.userLocation) delta.userLocation = draft.userLocation;

    // Status change
    if (selectedStatus != null && selectedStatus !== item.status) {
      delta.status = selectedStatus;
      // Business rules for User/Location based on status
      if (selectedStatus === "ready_to_deploy") {
        // Always set Inventory when status is Ready to Deploy
        delta.userLocation = "Inventory";
      } else if (selectedStatus === "deployed") {
        // Require destination; use provided deployTo
        const to = deployTo.trim();
        if (to.length > 0) {
          delta.userLocation = to;
        }
      }
    }

    if (Object.keys(delta).length === 0) {
      // Nothing to save
      return;
    }

    try {
      setSaveLoading(true);
      setSaveError(null);

      let headers: HeadersInit = { "Content-Type": "application/json" };

      if (!isMock) {
        if (!API_SCOPE) {
          throw new Error("Missing API scope. Set NEXT_PUBLIC_AZURE_API_SCOPE or AZURE_API_SCOPE.");
        }
        const acct = activeAccount;
        if (!acct) {
          setNeedsLogin(true);
          throw new Error("Not authenticated");
        }

        const acquireSilentWithTimeout = async (timeoutMs = 10000): Promise<AuthenticationResult> => {
          const p = instance.acquireTokenSilent({
            scopes: [API_SCOPE],
            account: acct,
          });
          const timeout = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("acquireTokenSilent timeout")), timeoutMs)
          );
          return (await Promise.race([p, timeout])) as AuthenticationResult;
        };

        const resAuth = await acquireSilentWithTimeout(10000);
        headers = { ...headers, Authorization: `Bearer ${resAuth.accessToken}` };
      }

      const body = JSON.stringify({
        fields: delta,
        ...(etag ? { etag } : {}),
      });

      const res = await fetch(`/api/inventory/${assetNum}`, {
        method: "PATCH",
        headers,
        body,
        cache: "no-store",
      });

      if (!res.ok) {
        if (res.status === 412) {
          throw new Error("ETag mismatch");
        }
        const t = await res.text();
        throw new Error(`API ${res.status}: ${t}`);
      }

      const data = (await res.json()) as { item?: InventoryItem; eTag?: string };
      const newEtag =
        res.headers.get("ETag") ||
        res.headers.get("Etag") ||
        res.headers.get("etag") ||
        data.eTag ||
        null;
      if (newEtag) setEtag(newEtag);
      if (data.item) {
        setItem(data.item);
        // Sync selected status with saved item for consistency
        setSelectedStatus((data.item.status as InventoryStatus) ?? null);
      }

      // Close Asset overlay after successful save
      if (isOverlay) {
        try {
          onCloseOverlay?.();
        } catch {
          // ignore overlay errors
        }
      }

      // Trigger Lottie overlay feedback when saving from Asset overlay and status changed
      const savedStatus = ((data.item?.status as InventoryStatus) ?? (selectedStatus as InventoryStatus) ?? prevStatus) as InventoryStatus;
      if (isOverlay && prevStatus !== savedStatus) {
        try {
          if (savedStatus === "deployed") {
            await openOverlay({ url: "/animations/checkoutanimation.json", loop: false, speed: 1.1 });
          } else if (savedStatus === "ready_to_deploy") {
            await openOverlay({ url: "/animations/checkinanimation.json", loop: false, speed: 1.1 });
          }
        } catch {
          // ignore overlay errors
        }
      }

      // Clear draft and deploy destination after successful save
      setDraft(null);
      setDeployTo("");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Unknown error");
      // keep draft so user can retry
    } finally {
      setSaveLoading(false);
    }
  }, [assetNum, item, draft, selectedStatus, isMock, API_SCOPE, activeAccount, instance, etag]);

  // Clear any drafts when navigating to a different asset
  React.useEffect(() => {
    setDraft(null);
  }, [assetNum]);

  // Layout pieces

  const ImageBox = () => {
    if (loading) {
      return <Skeleton className={cn(fillLeft ? "h-full w-full rounded-md" : "aspect-[4/3] w-full max-w-md rounded-md")} />;
    }
    if (!item?.assetImage) {
      return (
        <div className={cn(fillLeft ? "h-full w-full rounded-md border grid place-items-center text-muted-foreground" : "aspect-[4/3] w-full max-w-md rounded-md border grid place-items-center text-muted-foreground")}>
          <span className="text-sm">No image</span>
        </div>
      );
    }
    return (
      <div className={cn(fillLeft ? "h-full w-full overflow-hidden rounded-md border bg-background" : "aspect-[4/3] w-full max-w-md overflow-hidden rounded-md border bg-background")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.assetImage}
          alt={`Asset ${item.asset}`}
          className="h-full w-full object-contain"
        />
      </div>
    );
  };


  if (needsLogin && !isMock) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Authentication Required</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Sign in to view live inventory from SharePoint.
          </p>
          <Button size="sm" onClick={handleSignIn}>
            Sign in
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Failed to load asset</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  // Grid layout to closely match mock: large image on the left, details/tabs on the right.
  const leftSpanClass = (typeof leftCols === "number" && leftCols === 7) ? "md:col-span-7" : "md:col-span-5";
  const rightSpanClass = (typeof rightCols === "number" && rightCols === 5) ? "md:col-span-5" : "md:col-span-7";
  const rootClass = fillLeft ? "h-full flex items-stretch" : "min-h-[70vh] flex items-center";
  const gridClass = cn(
    "grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 max-w-5xl md:max-w-6xl mx-auto w-full",
    fillLeft && "h-full"
  );

  return (
    <div className={rootClass}>
      <div className={gridClass}>
      {/* Left: Image container */}
      <div className={`${leftSpanClass} flex ${fillLeft ? "h-full" : ""} justify-center md:justify-start`}>
        <div className={fillLeft ? "w-full h-full" : "inline-block"}>
          <ImageBox />
        </div>
      </div>

      {/* Right: Tabs, header, details, and button row */}
      <div className={`${rightSpanClass} ${fillLeft ? "h-full" : ""} flex flex-col`}>
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as typeof activeTab)}
          className={fillLeft ? "h-full flex flex-col" : undefined}
        >
          <div className="relative">
            {loading && (
              <div className="absolute inset-0 flex gap-2">
                <Skeleton className="h-8 w-20 rounded-md" />
                <Skeleton className="h-8 w-20 rounded-md" />
              </div>
            )}
            <TabsList className={cn(loading && "invisible")}>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="details" className={fillLeft ? "flex-1 flex flex-col" : undefined}>
            {/* Asset header */}
            <div className="flex items-center justify-between mt-2 mb-3">
              <h4 className="text-xl font-semibold">
                {loading ? <Skeleton className="h-6 w-40" /> : item ? `Asset ${item.asset}` : "Asset"}
              </h4>
              {loading ? (
                <Skeleton className="h-8 w-16 rounded-md" />
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsEditOpen(true)}
                  disabled={loading || !item}
                  aria-label="Edit"
                >
                  <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
                  <span className="sr-only">Edit</span>
                </Button>
              )}
            </div>

            {/* Details table */}
            <div>
            {loading ? (
              <div className="space-y-2 rounded-md border p-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-5 w-full" />
                ))}
              </div>
            ) : workingItem ? (
              <AssetDetailsTable item={workingItem} />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Asset not found</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    The asset with number {asset} could not be found.
                  </p>
                </CardContent>
              </Card>
            )}
            </div>

            {/* Button row */}
            {loading ? (
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center gap-2">
                    <Skeleton className="h-8 w-36 rounded-full" />
                    <Skeleton className="h-8 w-28 rounded-full" />
                    <Skeleton className="h-8 w-24 rounded-full" />
                  </div>
                </div>
                <Skeleton className="h-8 w-16 rounded-md" />
              </div>
            ) : (
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-2">
                  <ButtonGroup
                    ariaLabel="Asset Status"
                    value={selectedStatus ?? item?.status ?? "ready_to_deploy"}
                    onChange={(val) => {
                      const v = val as InventoryStatus;
                      const current = (selectedStatus ?? item?.status ?? "ready_to_deploy") as InventoryStatus;
                      if (v === "deployed") {
                        // Defer status change until destination is confirmed
                        setStatusBeforePrompt(current);
                        setDeployDialogOpen(true);
                      } else {
                        setSelectedStatus(v);
                        if (v === "ready_to_deploy") {
                          // Clear any destination when switching to Ready to Deploy
                          setDeployTo("");
                        }
                      }
                    }}
                    options={[
                      { label: "Ready to Deploy", value: "ready_to_deploy", color: "ready" },
                      { label: "Deployed", value: "deployed", color: "deployed" },
                      { label: "Retired", value: "retired", color: "retired" },
                    ]}
                  />
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      disabled={!hasAnyChanges || saveLoading}
                      aria-disabled={!hasAnyChanges || saveLoading}
                      className="rounded-lg"
                    >
                      {saveLoading ? "Saving..." : "Save"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirm changes</AlertDialogTitle>
                      <AlertDialogDescription>
                        Confirm to apply changes to SharePoint.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        disabled={!hasAnyChanges || saveLoading}
                        onClick={() => {
                          void handleSave();
                        }}
                      >
                        Confirm
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
            {/* Deploy destination modal (shown when selecting Deployed) */}
            <ModalDialog
              open={deployDialogOpen}
              onOpenChange={(o) => {
                setDeployDialogOpen(o);
                if (!o && selectedStatus !== "deployed") {
                  // If closed without confirming, revert to the previously active status
                  setSelectedStatus(statusBeforePrompt ?? (item?.status as InventoryStatus) ?? "ready_to_deploy");
                  setDeployTo("");
                }
              }}
            >
              <ModalDialogContent>
                <ModalDialogHeader>
                  <ModalDialogTitle>Destination User/Location</ModalDialogTitle>
                  <ModalDialogDescription>
                    Select or enter the destination for this deployed asset.
                  </ModalDialogDescription>
                </ModalDialogHeader>
                <div className="mt-2">
                  <UserLocationSelect
                    id="deploy-destination-inline"
                    value={deployTo}
                    onChange={setDeployTo}
                    placeholder="Select or Enter User/Location"
                    showManualButton={false}
                    className="min-w-0"
                  />
                  {deployTo.trim().length === 0 && (
                    <div className="mt-2 text-sm text-destructive">
                      Destination is required when setting status to Deployed.
                    </div>
                  )}
                </div>
                <ModalDialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDeployDialogOpen(false);
                    }}
                  >
                    Close
                  </Button>
                  <Button
                    onClick={() => {
                      if (deployTo.trim().length > 0) {
                        // Commit status change to Deployed only after destination confirmed
                        setSelectedStatus("deployed");
                        setDeployDialogOpen(false);
                      }
                    }}
                    disabled={deployTo.trim().length === 0}
                  >
                    Done
                  </Button>
                </ModalDialogFooter>
              </ModalDialogContent>
            </ModalDialog>
          </TabsContent>

          <TabsContent value="history" forceMount className={fillLeft ? "flex-1 flex flex-col" : undefined}>
            {loading ? (
              <div className="space-y-2 rounded-md border p-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-5 w-full" />
                ))}
              </div>
            ) : historyLoading ? (
              <div className="space-y-2 rounded-md border p-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-5 w-full" />
                ))}
              </div>
            ) : historyError ? (
              <div className="rounded-md border p-3 text-sm text-destructive">
                {historyError}
              </div>
            ) : (
              <AssetHistoryTable events={historyEvents || []} className="mt-0" />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>

    <AssetEditSheet
      open={isEditOpen}
      onOpenChange={setIsEditOpen}
      item={workingItem}
      onUpdate={onUpdate}
    />
  </div>
  );
}
