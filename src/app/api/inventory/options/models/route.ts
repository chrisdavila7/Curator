import { NextRequest, NextResponse } from "next/server";
import { verifyApiAccessToken } from "@/lib/auth/msal-server";
import { listDistinctModelsViaScanWithUserToken } from "@/lib/graph/sharepoint";

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
 * GET /api/inventory/options/models
 * Query:
 *  - search?: string (optional client-side filter)
 *  - top?: number (default 50, max 200)
 * Response: { models: string[] }
 */
export async function GET(req: NextRequest) {
  try {
    const search = (req.nextUrl.searchParams.get("search") || "").trim();
    const topParam = Number.parseInt(req.nextUrl.searchParams.get("top") || "50", 10);
    const top = Math.max(1, Math.min(Number.isFinite(topParam) ? topParam : 50, 200));

    // Mock mode: derive distinct models from mock inventory dataset.
    if (isMockEnabled()) {
      const { mockInventory } = await import("@/data/inventory");
      const set = new Set<string>();
      for (const i of mockInventory) {
        const m = (i.model || "").trim();
        if (m) set.add(m);
      }
      let models = Array.from(set).sort((a, b) => a.localeCompare(b));
      if (search) {
        const s = search.toLowerCase();
        models = models.filter((m) => m.toLowerCase().includes(s));
      }
      models = models.slice(0, top);
      return json({ models }, { status: 200, headers: { "Cache-Control": "no-store" } });
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

    let models = await listDistinctModelsViaScanWithUserToken(token);
    if (search) {
      const s = search.toLowerCase();
      models = models.filter((m) => m.toLowerCase().includes(s));
    }
    models = models.slice(0, top);
    return json({ models }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: "Failed to fetch model options", detail: message }, { status: 500 });
  }
}
