"use client";

import * as React from "react";
import { useMsal } from "@azure/msal-react";
import type { AuthenticationResult, AccountInfo } from "@azure/msal-browser";
import type { InventoryItem } from "@/types/inventory";
import { DataTable } from "@/components/data-table/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { StatusBadge } from "@/components/status-badge";
import { statusLabel } from "@/lib/status-label";
import { ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import AssetViewOverlay from "@/components/asset/asset-view-overlay";
import PageHeader from "@/components/page-header";
import { useGlobalLoading } from "@/components/loading/loading-provider";

const isMock =
  process.env.NEXT_PUBLIC_USE_MOCK_INVENTORY === "true" ||
  process.env.USE_MOCK_INVENTORY === "true";

const API_SCOPE =
  process.env.NEXT_PUBLIC_AZURE_API_SCOPE ||
  process.env.AZURE_API_SCOPE ||
  "";

/**
 * Assets page: shows a single table with EVERY inventory row (from SharePoint),
 * ordered from least to greatest Asset number. Layout mirrors the provided mock:
 * - Page title top-left
 * - Search input affordance top-right
 * - A single rounded table card below
 */
function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function Highlight({ text, tokens }: { text: string | number; tokens: string[] }) {
  const str = String(text ?? "");
  if (!tokens.length || !str) return <>{str}</>;
  const escaped = tokens.filter(Boolean).map(escapeRegExp);
  if (!escaped.length) return <>{str}</>;
  const regex = new RegExp(`(${escaped.join("|")})`, "ig");
  const parts = str.split(regex);
  return (
    <>
      {parts.map((part, i) => {
        const isMatch = tokens.some((t) => part.toLowerCase() === t.toLowerCase());
        return isMatch ? (
          <span key={i} className="font-semibold bg-yellow-200 dark:bg-yellow-800/40 rounded-sm px-0.5">
            {part}
          </span>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        );
      })}
    </>
  );
}

function buildInventoryColumnsWithHighlight(
  tokens: string[],
  onAssetClick?: (asset: number) => void,
  selectedModel?: string,
  selectedUserLocation?: string,
  selectedStatus?: string
): ColumnDef<InventoryItem>[] {
  return [
    {
      id: "asset",
      accessorKey: "asset",
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Asset
          <ArrowUpDown className="ml-2 size-4" />
        </Button>
      ),
      cell: ({ row, column }) => {
        const asset = row.original.asset;
        if (!asset) return <span className={column.getIsSorted() ? "font-bold" : undefined}>—</span>;
        return (
            <Link
              href={`/asset/${asset}`}
              className={`no-underline underline-offset-2 hover:underline focus:underline focus:outline-none focus:ring-2 focus:ring-ring rounded-sm ${column.getIsSorted() ? "font-bold" : ""}`}
              aria-label={`View Asset ${asset}`}
            onClick={(e) => {
              if (
                onAssetClick &&
                !e.defaultPrevented &&
                !e.metaKey &&
                !e.ctrlKey &&
                !e.shiftKey &&
                !e.altKey &&
                e.button === 0
              ) {
                e.preventDefault();
                onAssetClick(asset);
              }
            }}
          >
            <Highlight text={String(asset)} tokens={tokens} />
          </Link>
        );
      },
    },
    {
      id: "model",
      accessorKey: "model",
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Model
          <ArrowUpDown className="ml-2 size-4" />
        </Button>
      ),
      cell: ({ row, column }) => (
        <span className={column.getIsSorted() || !!selectedModel ? "font-bold" : undefined}>
          <Highlight text={row.original.model} tokens={tokens} />
        </span>
      ),
    },
    {
      id: "serial",
      accessorKey: "serial",
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Serial
          <ArrowUpDown className="ml-2 size-4" />
        </Button>
      ),
      cell: ({ row, column }) => (
        <span className={column.getIsSorted() ? "font-bold" : undefined}>
          <Highlight text={row.original.serial} tokens={tokens} />
        </span>
      ),
    },
    {
      id: "userLocation",
      accessorKey: "userLocation",
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          User/Location
          <ArrowUpDown className="ml-2 size-4" />
        </Button>
      ),
      cell: ({ row, column }) => (
        <span className={column.getIsSorted() || !!selectedUserLocation ? "font-bold text-foreground" : "text-muted-foreground"}>
          <Highlight text={row.original.userLocation} tokens={tokens} />
        </span>
      ),
    },
    {
      id: "status",
      accessorKey: "status",
      header: "Status",
      cell: ({ row, column }) => {
        const st = row.original.status;
        return (
          <StatusBadge
            status={st}
            className={column.getIsSorted() || !!selectedStatus ? "font-bold" : undefined}
          >
            <Highlight text={statusLabel(st)} tokens={tokens} />
          </StatusBadge>
        );
      },
    },
    {
      id: "modified",
      accessorKey: "modified",
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Modified
          <ArrowUpDown className="ml-2 size-4" />
        </Button>
      ),
      cell: ({ row, column }) => (
        <span className={column.getIsSorted() ? "font-bold" : undefined}>
          <Highlight text={row.original.modified} tokens={tokens} />
        </span>
      ),
    },
  ];
}

export default function AssetsPage() {
  const { instance, accounts } = useMsal();
  const [msalReady, setMsalReady] = React.useState(false);
  const { withGlobalLoading } = useGlobalLoading();

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
        // ignore; sign-in prompt handles errors
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

  const [items, setItems] = React.useState<InventoryItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [needsLogin, setNeedsLogin] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [selectedModel, setSelectedModel] = React.useState("");
  const modelOptions = React.useMemo(() => {
    const set = new Set<string>();
    for (const i of items) {
      if (i.model) set.add(i.model);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const [selectedUserLocation, setSelectedUserLocation] = React.useState("");
  const userLocationOptions = React.useMemo(() => {
    const set = new Set<string>();
    for (const i of items) {
      if (i.userLocation) set.add(i.userLocation);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const [selectedStatus, setSelectedStatus] = React.useState("");
  const statusOptions = React.useMemo(() => {
    const set = new Set<string>();
    for (const i of items) {
      if (i.status) set.add(i.status);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);


  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  const [assetOverlayOpen, setAssetOverlayOpen] = React.useState(false);
  const [assetOverlayId, setAssetOverlayId] = React.useState<number | null>(null);
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

  const loadAll = React.useCallback(async () => {
    await withGlobalLoading(
      (async () => {
        setLoading(true);
        setError(null);

        try {
          // Ensure MSAL is initialized before attempting token acquisition
          if (!isMock && !msalReady) {
            try {
              await instance.initialize();
            } catch {
              // ignore here
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

          const res = await fetch("/api/inventory", { method: "GET", headers });
          if (!res.ok) {
            const text = await res.text();
            throw new Error(`API ${res.status}: ${text}`);
          }
          const data = (await res.json()) as InventoryItem[];
          // Sort ascending by asset number
          data.sort((a, b) => (a.asset || 0) - (b.asset || 0));
          setItems(data);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Unknown error");
        } finally {
          setLoading(false);
        }
      })()
    );
  }, [withGlobalLoading, activeAccount, instance, msalReady, triggerLogin]);

  React.useEffect(() => {
    void loadAll();
  }, [loadAll]);

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

  // Debounce query to avoid filtering on every keystroke
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  // Compute filtered items based on debounced query
  const filteredItems = React.useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    const tokens = q ? q.split(/\s+/) : [];

    const toHay = (i: InventoryItem) => {
      const statusLabel = i.status === "ready_to_deploy" ? "ready to deploy" : i.status;
      return [String(i.asset), i.model, i.serial, i.userLocation, statusLabel]
        .join(" ")
        .toLowerCase();
    };

    return items
      .filter((i) => (selectedModel ? i.model === selectedModel : true))
      .filter((i) => (selectedUserLocation ? i.userLocation === selectedUserLocation : true))
      .filter((i) => (selectedStatus ? i.status === selectedStatus : true))
      .filter((i) => {
        if (!tokens.length) return true;
        const hay = toHay(i);
        return tokens.every((t) => hay.includes(t));
      });
  }, [items, debouncedQuery, selectedModel, selectedUserLocation, selectedStatus]);

  const highlightTokens = React.useMemo(() => {
    const q = debouncedQuery.trim();
    return q ? q.split(/\s+/) : [];
  }, [debouncedQuery]);

  const onAssetClick = React.useCallback((asset: number) => {
    setAssetOverlayId(asset);
    setAssetOverlayOpen(true);
  }, []);

  const columns = React.useMemo(
    () =>
      buildInventoryColumnsWithHighlight(
        highlightTokens,
        onAssetClick,
        selectedModel,
        selectedUserLocation,
        selectedStatus
      ),
    [highlightTokens, onAssetClick, selectedModel, selectedUserLocation, selectedStatus]
  );

  return (
    <div className="flex flex-col gap-[1.875rem]">
      {/* Header row: title */}
      <PageHeader />

      {/* Content: single rounded card containing the full inventory table */}
      {needsLogin && !isMock ? (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Authentication Required</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Sign in to view inventory from SharePoint.
            </p>
            <Button size="sm" onClick={handleSignIn}>Sign in</Button>
          </CardContent>
        </Card>
      ) : loading ? (
        <Card className="rounded-2xl">
          <CardContent className="py-6 space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Failed to load inventory</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-sm text-destructive">{error}</p>
            {!isMock && (
              <Button size="sm" variant="outline" onClick={handleSignIn}>Try Sign In</Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="rounded-2xl border-8 border-white bg-white shadow-[inset_2px_2px_8px_rgba(0,0,0,0.1),0_10px_15px_-3px_rgb(0,0,0,0.15),_0_4px_6px_-4px_rgb(0,0,0,0.15)]">
            <CardContent className="rounded-2xl pt-4">
              <div className="flex items-center gap-2 pb-3">
                <Input
                  className="w-1/4"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search..."
                  aria-label="Search"
                  disabled={loading}
                />
                <select
                  id="model-filter"
                  aria-label="Filter by model"
                  className="h-9 w-1/4 rounded-md border border-input bg-transparent px-3 py-1 md:text-sm ml-4"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  disabled={loading}
                >
                  <option value="">All Models</option>
                  {modelOptions.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <select
                  id="userloc-filter"
                  aria-label="Filter by user/location"
                  className="h-9 w-[18.75%] rounded-md border border-input bg-transparent px-3 py-1 md:text-sm"
                  value={selectedUserLocation}
                  onChange={(e) => setSelectedUserLocation(e.target.value)}
                  disabled={loading}
                >
                  <option value="">All Locations</option>
                  {userLocationOptions.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
                <select
                  id="status-filter"
                  aria-label="Filter by status"
                  className="h-9 w-[12.5%] rounded-md border border-input bg-transparent px-3 py-1 md:text-sm"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  disabled={loading}
                >
                  <option value="">All Statuses</option>
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                {query ? (
                  <Button variant="outline" size="sm" onClick={() => setQuery("")}>
                    Clear
                  </Button>
                ) : null}
              </div>
              <DataTable
                key={`table-${filteredItems.length}-${debouncedQuery}-${selectedModel}-${selectedUserLocation}-${selectedStatus}`}
                columns={columns}
                data={filteredItems}
                pageSize={25}
                showPagination={true}
                tableClassName="table-fixed [&_th:first-child]:pl-3 [&_td:first-child]:pl-3 [&_th:last-child]:pr-3 [&_td:last-child]:pr-3 bg-neutral-50 rounded-lg"
              />
            </CardContent>
          </Card>

          <AssetViewOverlay
            open={assetOverlayOpen}
            onOpenChange={setAssetOverlayOpen}
            asset={assetOverlayId ?? undefined}
          />
        </>
      )}
    </div>
  );
}
