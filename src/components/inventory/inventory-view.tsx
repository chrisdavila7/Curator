"use client";

import * as React from "react";
import { useMsal } from "@azure/msal-react";
import type { AccountInfo, AuthenticationResult } from "@azure/msal-browser";
import type { InventoryItem } from "@/types/inventory";
import { DataTable } from "@/components/data-table/data-table";
import { inventoryColumns, deployedCardColumns, deployedCardColumnsNoModified } from "@/components/data-table/columns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { startOfUtcDay, startOfUtcIsoWeek, startOfUtcMonth } from "@/lib/date-utc";
import AssetViewOverlay from "@/components/asset/asset-view-overlay";

const isMock =
  process.env.NEXT_PUBLIC_USE_MOCK_INVENTORY === "true" ||
  process.env.USE_MOCK_INVENTORY === "true";

const API_SCOPE =
  process.env.NEXT_PUBLIC_AZURE_API_SCOPE ||
  process.env.AZURE_API_SCOPE ||
  "";

// Augmented shape returned by /api/inventory?recent=10
type ActivityItem = InventoryItem & {
  _activityDateTime?: string;
  _latestChangedField?:
    | "asset"
    | "userLocation"
    | "status"
    | "serial"
    | "model"
    | "assetImage"
    | "notes";
};

export function InventoryView() {
  const { instance, accounts } = useMsal();
  const [items, setItems] = React.useState<InventoryItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = React.useState(false);
  const [msalReady, setMsalReady] = React.useState(false);
  const [recentItems, setRecentItems] = React.useState<ActivityItem[]>([]);
  // Auto sign-in helper to ensure SharePoint (Graph) access via API token
  const attemptedLoginRef = React.useRef(false);
  const triggerLogin = React.useCallback(async () => {
    if (attemptedLoginRef.current) return;
    attemptedLoginRef.current = true;
    if (!API_SCOPE) {
      setError("Missing API scope. Set NEXT_PUBLIC_AZURE_API_SCOPE or AZURE_API_SCOPE.");
      return;
    }
    try {
      await instance.initialize();
    } catch {
      // ignore init error; MSAL will surface if needed
    }
    await instance.loginRedirect({ scopes: [API_SCOPE] });
  }, [instance]);
  const [deployedWeek, setDeployedWeek] = React.useState<InventoryItem[]>([]);
  const [deployedMonth, setDeployedMonth] = React.useState<InventoryItem[]>([]);
  const [deployedToday, setDeployedToday] = React.useState<InventoryItem[]>([]);
  const [assetOverlayOpen, setAssetOverlayOpen] = React.useState(false);
  const [assetOverlayId, setAssetOverlayId] = React.useState<number | null>(null);

  const activeAccount = React.useMemo<AccountInfo | null>(() => {
    return instance.getActiveAccount() || accounts[0] || null;
  }, [instance, accounts]);

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

    // safety: unstick after 2s even if initialize hangs
    timer = setTimeout(() => {
      if (!cancelled) setMsalReady(true);
    }, 2000);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [instance]);

  const loadData = React.useCallback(async () => {
    // Debug to trace loading gate
    console.debug("InventoryView loadData start", { isMock, msalReady, hasAccount: !!activeAccount });
    try {
      setLoading(true);
      setError(null);
      // Ensure MSAL is initialized here so we don't early-return and leave loading stuck.
      if (!isMock && !msalReady) {
        try {
          await instance.initialize();
        } catch {
          // ignore init error here; loginRedirect will surface errors later
        }
      }

      let headers: HeadersInit = {};

      if (!isMock) {
        if (!API_SCOPE) {
          throw new Error("Missing API scope. Set NEXT_PUBLIC_AZURE_API_SCOPE or AZURE_API_SCOPE.");
        }
        if (!activeAccount) {
          void triggerLogin();
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
          void triggerLogin();
          return;
        }
      }

      // Fetch core dataset first; then load secondary datasets with graceful degradation.
      const resAll = await fetch("/api/inventory", { method: "GET", headers });
      if (!resAll.ok) {
        const text = await resAll.text();
        throw new Error(`API ${resAll.status}: ${text}`);
      }
      const dataAll = (await resAll.json()) as InventoryItem[];
      setItems(dataAll);


      const toMs = (s?: string) => {
        if (!s) return 0;
        const t = new Date(s).getTime();
        return Number.isNaN(t) ? 0 : t;
      };

      const [recentSettled, todaySettled, weekSettled, monthSettled] = await Promise.allSettled([
        fetch("/api/inventory?recent=10", { method: "GET", headers }).then(async (r) => {
          if (!r.ok) throw new Error(await r.text());
          return (await r.json()) as ActivityItem[];
        }),
        fetch("/api/inventory?deployedSince=today", { method: "GET", headers }).then(async (r) => {
          if (!r.ok) throw new Error(await r.text());
          return (await r.json()) as InventoryItem[];
        }),
        fetch("/api/inventory?deployedSince=week", { method: "GET", headers }).then(async (r) => {
          if (!r.ok) throw new Error(await r.text());
          return (await r.json()) as InventoryItem[];
        }),
        fetch("/api/inventory?deployedSince=month", { method: "GET", headers }).then(async (r) => {
          if (!r.ok) throw new Error(await r.text());
          return (await r.json()) as InventoryItem[];
        }),
      ]);

      if (recentSettled.status === "fulfilled") {
        setRecentItems(recentSettled.value);
      } else {
        console.warn("recent activity fetch failed", recentSettled.reason);
        setRecentItems([]);
      }

      const now = new Date();
      const daySinceMs = startOfUtcDay(now).getTime();
      const weekSinceMs = startOfUtcIsoWeek(now).getTime();
      const monthSinceMs = startOfUtcMonth(now).getTime();

      if (todaySettled.status === "fulfilled") {
        setDeployedToday(todaySettled.value);
      } else {
        console.warn("deployedSince=today fetch failed", todaySettled.reason);
        const approxToday = dataAll
          .filter((i) => i.status === "deployed")
          .filter((i) => toMs(i.modified || i.created) >= daySinceMs)
          .sort((a, b) => toMs(b.modified || b.created) - toMs(a.modified || a.created))
          .slice(0, 50);
        setDeployedToday(approxToday);
      }

      if (weekSettled.status === "fulfilled") {
        setDeployedWeek(weekSettled.value);
      } else {
        console.warn("deployedSince=week fetch failed", weekSettled.reason);
        const approxWeek = dataAll
          .filter((i) => i.status === "deployed")
          .filter((i) => toMs(i.modified || i.created) >= weekSinceMs)
          .sort((a, b) => toMs(b.modified || b.created) - toMs(a.modified || a.created))
          .slice(0, 50);
        setDeployedWeek(approxWeek);
      }

      if (monthSettled.status === "fulfilled") {
        setDeployedMonth(monthSettled.value);
      } else {
        console.warn("deployedSince=month fetch failed", monthSettled.reason);
        const approxMonth = dataAll
          .filter((i) => i.status === "deployed")
          .filter((i) => toMs(i.modified || i.created) >= monthSinceMs)
          .sort((a, b) => toMs(b.modified || b.created) - toMs(a.modified || a.created))
          .slice(0, 50);
        setDeployedMonth(approxMonth);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [activeAccount, instance, msalReady]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  // If MSAL is ready but there is no active account, show sign-in card immediately
  React.useEffect(() => {
    if (!isMock && msalReady && !activeAccount) {
      void triggerLogin();
    }
  }, [isMock, msalReady, activeAccount, triggerLogin]);

  const handleSignIn = async () => {
    if (!API_SCOPE) {
      setError("Missing API scope. Set NEXT_PUBLIC_AZURE_API_SCOPE or AZURE_API_SCOPE.");
      return;
    }
    await instance.initialize();
    await instance.loginRedirect({ scopes: [API_SCOPE] });
  };

  if (needsLogin && !isMock) {
    return (
      <Card className="md:col-span-3">
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

  if (loading) {
    return (
      <>
        <Card>
        <CardHeader>
          <CardTitle className="text-base">Checked Out Today</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </CardContent>
        </Card>
        <Card>
        <CardHeader>
          <CardTitle className="text-base">Checked Out This Week</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </CardContent>
        </Card>
        <Card>
        <CardHeader>
          <CardTitle className="text-base">Checked Out This Month</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </CardContent>
        </Card>
        <Card className="md:col-span-3">
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </CardContent>
        </Card>
      </>
    );
  }

  if (error) {
    return (
      <Card className="md:col-span-3">
        <CardHeader>
          <CardTitle className="text-base">Failed to load inventory</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{error}</p>
          {!isMock && (
            <div className="mt-3">
              <Button size="sm" variant="outline" onClick={handleSignIn}>
                Try Sign In
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  const a = deployedToday.slice(0, 5);
  const b = deployedWeek.slice(0, 5);
  const c = deployedMonth.slice(0, 5);

  // Unify table items so we can access optional activity props without any casts
  const tableItems: ActivityItem[] = recentItems.length
    ? recentItems
    : items.map((i) => i as ActivityItem);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Checked Out Today</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={deployedCardColumnsNoModified}
            data={a}
            pageSize={5}
            showPagination={false}
            compact
            tableClassName="table-fixed [&_th:first-child]:pl-3 [&_td:first-child]:pl-3 [&_th:last-child]:pr-3 [&_td:last-child]:pr-3"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Checked Out This Week</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={deployedCardColumns}
            data={b}
            pageSize={5}
            showPagination={false}
            compact
            tableClassName="[&_th:first-child]:pl-3 [&_td:first-child]:pl-3 [&_th:last-child]:pr-3 [&_td:last-child]:pr-3"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Checked Out This Month</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={deployedCardColumns}
            data={c}
            pageSize={5}
            showPagination={false}
            compact
            tableClassName="[&_th:first-child]:pl-3 [&_td:first-child]:pl-3 [&_th:last-child]:pr-3 [&_td:last-child]:pr-3"
          />
        </CardContent>
      </Card>

      <Card className="md:col-span-3">
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[420px] w-full">
            <Table className="text-sm [&_th]:px-1 [&_td]:px-1 [&_th]:py-1 [&_td]:py-1 [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap [&_th:first-child]:pl-3 [&_td:first-child]:pl-3 [&_th:last-child]:pr-3 [&_td:last-child]:pr-3">
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Serial</TableHead>
                  <TableHead>User/Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Modified</TableHead>
                  <TableHead className="text-right">Modified By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableItems.map((item) => (
                  <TableRow key={item.asset}>
                    <TableCell>
                      <Link
                        href={`/asset/${item.asset}`}
                        className="no-underline underline-offset-2 hover:underline focus:underline"
                        aria-label={`View Asset ${item.asset}`}
                        onClick={(e) => {
                          // Allow new tab/window and non-left clicks to behave normally
                          if (
                            e.defaultPrevented ||
                            e.metaKey ||
                            e.ctrlKey ||
                            e.shiftKey ||
                            e.altKey ||
                            (e as unknown as MouseEvent).button !== 0
                          ) {
                            return;
                          }
                          e.preventDefault();
                          setAssetOverlayId(item.asset);
                          setAssetOverlayOpen(true);
                        }}
                      >
                        {item.asset}
                      </Link>
                      {item._latestChangedField === "asset" && (
                        <span className="ml-0.5 inline-block size-2 rounded-full bg-emerald-500 dark:bg-emerald-400 align-middle" />
                      )}
                    </TableCell>
                    <TableCell>
                      {item.model}
                      {item._latestChangedField === "model" && (
                        <span className="ml-0.5 inline-block size-2 rounded-full bg-emerald-500 dark:bg-emerald-400 align-middle" />
                      )}
                    </TableCell>
                    <TableCell>
                      {item.serial}
                      {item._latestChangedField === "serial" && (
                        <span className="ml-0.5 inline-block size-2 rounded-full bg-emerald-500 dark:bg-emerald-400 align-middle" />
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.userLocation}
                      {item._latestChangedField === "userLocation" && (
                        <span className="ml-0.5 inline-block size-2 rounded-full bg-emerald-500 dark:bg-emerald-400 align-middle" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          item.status === "deployed"
                            ? "checkout"
                            : item.status === "ready_to_deploy"
                            ? "checkin"
                            : "destructive"
                        }
                      >
                        {item.status === "deployed"
                          ? "Deployed"
                          : item.status === "ready_to_deploy"
                          ? "Ready to Deploy"
                          : "Retired"}
                      </Badge>
                      {item._latestChangedField === "status" && (
                        <span className="ml-0.5 inline-block size-2 rounded-full bg-emerald-500 dark:bg-emerald-400 align-middle" />
                      )}
                    </TableCell>
                    <TableCell>{item.modified}</TableCell>
                    <TableCell className="text-right">{item.modifiedBy}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
      {/* Overlay for viewing an asset without leaving the current page */}
      <AssetViewOverlay
        open={assetOverlayOpen}
        onOpenChange={setAssetOverlayOpen}
        asset={assetOverlayId ?? undefined}
      />
    </>
  );
}
