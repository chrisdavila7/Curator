import { NextRequest, NextResponse } from "next/server";
import { verifyApiAccessToken } from "@/lib/auth/msal-server";
import { searchUsersWithUserToken, listDistinctUsersViaScanWithUserToken } from "@/lib/graph/sharepoint";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth) return null;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

/**
 * Mock mode is enabled if either server or client mock env var is set.
 */
function isMockEnabled(): boolean {
  return (
    process.env.USE_MOCK_INVENTORY === "true" ||
    process.env.NEXT_PUBLIC_USE_MOCK_INVENTORY === "true"
  );
}

/**
 * GET /api/inventory/options/users
 * Query:
 *  - search?: string (optional; when provided must be ≥ 2 chars; when omitted returns suggestions)
 *  - top?: number (default 20, max 50)
 * Response: { users: Array<{ id, displayName?, mail?, userPrincipalName? }> }
 */
export async function GET(req: NextRequest) {
  try {
    const search = (req.nextUrl.searchParams.get("search") || "").trim();
    const topParam = Number.parseInt(req.nextUrl.searchParams.get("top") || "20", 10);
    const top = Math.max(1, Math.min(Number.isFinite(topParam) ? topParam : 20, 50));
    const hasSearch = req.nextUrl.searchParams.has("search");

    if (hasSearch && search.length < 2) {
      return json({ error: "Query parameter 'search' must be at least 2 characters" }, { status: 400 });
    }

    // Mock mode: synthesize user options from mock inventory fields
    if (isMockEnabled()) {
      const { mockInventory } = await import("@/data/inventory");
      const set = new Set<string>();

      // Collect names from createdBy/modifiedBy and userLocation prefixes
      for (const i of mockInventory) {
        if (i.createdBy) set.add(i.createdBy.trim());
        if (i.modifiedBy) set.add(i.modifiedBy.trim());
        if (i.userLocation) {
          const parts = i.userLocation.split(/[\/–-]/); // split on "/", en dash, hyphen
          const candidate = (parts[0] || "").trim();
          if (candidate && candidate.length > 1) set.add(candidate);
        }
      }
      let names = Array.from(set).filter(Boolean);
      const s = search.toLowerCase();
      names = names.filter((n) => n.toLowerCase().includes(s)).slice(0, top);
      const users = names.map((n, idx) => ({
        id: `mock-${idx}-${n.toLowerCase().replace(/\s+/g, "-")}`,
        displayName: n,
        mail: null as string | null,
        userPrincipalName: null as string | null,
      }));
      return json({ users }, { status: 200, headers: { "Cache-Control": "no-store" } });
    }

    const token = getBearerToken(req);
    if (!token) {
      return json({ error: "Missing Authorization: Bearer <token>" }, { status: 401 });
    }

    if (process.env.AZURE_VERIFY_JWT === "true") {
      try {
        await verifyApiAccessToken(token);
      } catch {
        return json({ error: "Invalid or unauthorized token" }, { status: 401 });
      }
    }

    let users;
    if (hasSearch && search.length >= 2) {
      try {
        users = await searchUsersWithUserToken(token, search, top);
      } catch {
        // Fallback to list scan suggestions filtered by search
        const names = await listDistinctUsersViaScanWithUserToken(token);
        const s = search.toLowerCase();
        users = names
          .filter((n) => n.toLowerCase().includes(s))
          .slice(0, top)
          .map((n, idx) => ({
            id: `suggestion-${idx}-${n.toLowerCase().replace(/\s+/g, "-")}`,
            displayName: n,
            mail: null as string | null,
            userPrincipalName: null as string | null,
          }));
      }
    } else {
      // Initial suggestions when no search provided
      const names = await listDistinctUsersViaScanWithUserToken(token);
      users = names.slice(0, top).map((n, idx) => ({
        id: `suggestion-${idx}-${n.toLowerCase().replace(/\s+/g, "-")}`,
        displayName: n,
        mail: null as string | null,
        userPrincipalName: null as string | null,
      }));
    }
    return json({ users }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: "Failed to search users", detail: message }, { status: 500 });
  }
}
