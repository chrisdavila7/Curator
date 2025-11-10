"use client";

import * as React from "react";
import { useMsal } from "@azure/msal-react";
import type { AccountInfo, AuthenticationResult } from "@azure/msal-browser";

export type UserOption = {
  id: string;
  displayName?: string | null;
  mail?: string | null;
  userPrincipalName?: string | null;
};

const isMock =
  process.env.NEXT_PUBLIC_USE_MOCK_INVENTORY === "true" ||
  process.env.USE_MOCK_INVENTORY === "true";

const API_SCOPE =
  process.env.NEXT_PUBLIC_AZURE_API_SCOPE ||
  process.env.AZURE_API_SCOPE ||
  "";

/**
 * Acquire API auth headers using msal-react. Returns {} in mock mode.
 * Throws if live mode and token cannot be acquired.
 */
async function getAuthHeaders(instance: ReturnType<typeof useMsal>["instance"], account: AccountInfo | null, timeoutMs = 10000): Promise<HeadersInit> {
  if (isMock) return {};
  if (!API_SCOPE) {
    throw new Error("Missing API scope. Set NEXT_PUBLIC_AZURE_API_SCOPE or AZURE_API_SCOPE.");
  }
  const acct = account || instance.getActiveAccount() || null;
  if (!acct) throw new Error("Not authenticated");

  const p = instance.acquireTokenSilent({ scopes: [API_SCOPE], account: acct });
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("acquireTokenSilent timeout")), timeoutMs)
  );
  const res = (await Promise.race([p, timeout])) as AuthenticationResult;
  return { Authorization: `Bearer ${res.accessToken}` };
}

function useActiveAccount() {
  const { instance, accounts } = useMsal();
  const active = React.useMemo<AccountInfo | null>(() => {
    return instance.getActiveAccount() || accounts[0] || null;
  }, [instance, accounts]);
  return { instance, activeAccount: active };
}

/**
 * Model options (free-text field today) via /api/inventory/options/models
 * Fetches when the menu is open and search changes (debounced).
 */
export function useModelOptions(open: boolean, search: string, top = 50) {
  const { instance, activeAccount } = useActiveAccount();
  const [models, setModels] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      // Reset transient state when closed
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        const headers: HeadersInit = isMock ? {} : await getAuthHeaders(instance, activeAccount);
        const url = `/api/inventory/options/models?top=${Math.max(1, Math.min(top, 200))}&search=${encodeURIComponent(search || "")}`;
        const res = await fetch(url, { headers, cache: "no-store", signal: controller.signal });
        if (!res.ok) {
          const t = await res.text().catch(() => "");
          throw new Error(`Models ${res.status}: ${t}`);
        }
        const data = (await res.json()) as { models?: string[] };
        setModels(Array.isArray(data.models) ? data.models : []);
      } catch (e) {
        const err = e as unknown;
        if (typeof err === "object" && err !== null && "name" in err && (err as { name?: string }).name === "AbortError") {
          return;
        }
        setError(e instanceof Error ? e.message : "Unknown error");
        setModels([]);
      } finally {
        setLoading(false);
      }
    }, search ? 250 : 0); // no delay for initial open; debounce when typing

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [open, search, top, instance, activeAccount]);

  const refresh = React.useCallback(() => {
    // Trigger effect by toggling a no-op dependency: use timestamp
    // Consumers can change `top` or `search` to refire; keeping simple for now.
  }, []);

  return { models, loading, error, refresh };
}

/**
 * User search via /api/inventory/options/users.
 * - When query length ≥ 2: performs directory search (server may fallback to list suggestions).
 * - When query length < 2 (or empty) and menu is open: fetches initial suggestions from SharePoint list scan.
 */
export function useUserSearch(query: string, open: boolean, top = 20) {
  const { instance, activeAccount } = useActiveAccount();
  const [users, setUsers] = React.useState<UserOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setUsers([]);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        const headers: HeadersInit = isMock ? {} : await getAuthHeaders(instance, activeAccount);
        const hasQuery = !!query && query.trim().length >= 2;
        const base = `/api/inventory/options/users?top=${Math.max(1, Math.min(top, 50))}`;
        const url = hasQuery ? `${base}&search=${encodeURIComponent(query.trim())}` : base;
        const res = await fetch(url, { headers, cache: "no-store", signal: controller.signal });
        if (!res.ok) {
          const t = await res.text().catch(() => "");
          throw new Error(`Users ${res.status}: ${t}`);
        }
        const data = (await res.json()) as { users?: UserOption[] };
        setUsers(Array.isArray(data.users) ? data.users : []);
      } catch (e) {
        const err = e as unknown;
        if (typeof err === "object" && err !== null && "name" in err && (err as { name?: string }).name === "AbortError") {
          return;
        }
        setError(e instanceof Error ? e.message : "Unknown error");
        setUsers([]);
      } finally {
        setLoading(false);
      }
    }, 300); // debounce both suggestions and search

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [open, query, top, instance, activeAccount]);

  return { users, loading, error };
}

/**
 * Static locations list via /api/inventory/options/locations (fetched once).
 */
export function useLocations() {
  const { instance, activeAccount } = useActiveAccount();
  const [locations, setLocations] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchOnce = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const headers: HeadersInit = isMock ? {} : await getAuthHeaders(instance, activeAccount);
      const res = await fetch(`/api/inventory/options/locations`, { headers, cache: "no-store" });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`Locations ${res.status}: ${t}`);
      }
      const data = (await res.json()) as { locations?: string[] };
      setLocations(Array.isArray(data.locations) ? data.locations : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setLocations([]);
    } finally {
      setLoading(false);
    }
  }, [instance, activeAccount]);

  React.useEffect(() => {
    // Fetch lazily when authenticated (or in mock), and refetch if auth becomes available after initial mount
    if (locations.length === 0 && !loading && !error && (isMock || activeAccount)) {
      void fetchOnce();
    }
  }, [locations.length, loading, error, activeAccount, fetchOnce]);

  return { locations, loading, error, refetch: fetchOnce };
}
