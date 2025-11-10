import { NextRequest, NextResponse } from "next/server";
import {
  captureGraphMetrics,
  searchInventoryByAssetPrefixWithUserToken,
} from "@/lib/graph/sharepoint";
import { verifyApiAccessToken } from "@/lib/auth/msal-server";
import type { InventoryItem } from "@/types/inventory";

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

function sanitizePrefix(q: string | null): string {
  return String(q || "").trim().replace(/[^0-9]/g, "");
}

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q");
    const prefix = sanitizePrefix(q);
    const topParam = req.nextUrl.searchParams.get("top");
    const top = Math.max(1, Math.min(Number.parseInt(topParam || "10", 10) || 10, 50));

    if (!prefix) {
      return json([], {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      });
    }

    // Mock mode short-circuit
    if (process.env.USE_MOCK_INVENTORY === "true") {
      const { mockInventory } = await import("@/data/inventory");
      const filtered = mockInventory
        .filter((i: InventoryItem) => String(i.asset).startsWith(prefix))
        .slice(0, top);
      return json(filtered, {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      });
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

    const { result: items, metrics } = await captureGraphMetrics(() =>
      searchInventoryByAssetPrefixWithUserToken(token, prefix, top)
    );

    const headers: HeadersInit = { "Cache-Control": "no-store" };
    if (process.env.DEBUG_GRAPH === "true" && metrics.length) {
      const totalRetries = metrics.reduce((acc, m) => acc + (m.retryCount || 0), 0);
      const totalDuration = metrics.reduce((acc, m) => acc + (m.durationMs || 0), 0);
      (headers as Record<string, string>)["X-Graph-Retries"] = String(totalRetries);
      (headers as Record<string, string>)["X-Graph-Duration"] = String(totalDuration);
    }

    return json(items, {
      status: 200,
      headers,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: "Failed to search inventory", detail: message }, { status: 500 });
  }
}
