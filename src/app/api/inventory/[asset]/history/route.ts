import { NextRequest, NextResponse } from "next/server";
import { captureGraphMetrics, findListItemIdByAssetWithUserToken, fetchListItemVersions } from "@/lib/graph/sharepoint";
import { verifyApiAccessToken } from "@/lib/auth/msal-server";
import { computeAssetHistoryEvents } from "@/lib/history";
import { acquireOboToken } from "@/lib/auth/msal-server";

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

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ asset?: string }> }
) {
  try {
    const { asset } = await context.params;
    const assetParam = (asset || "").trim();
    const assetNum = Number.parseInt(assetParam, 10);
    if (!assetParam || !Number.isFinite(assetNum)) {
      return json({ error: "Invalid asset id" }, { status: 400 });
    }

    // In mock mode we do not have versions; return empty history (stable contract)
    if (process.env.USE_MOCK_INVENTORY === "true") {
      return json([], {
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

    // page size for versions to inspect (upper bounded)
    const topParam = req.nextUrl.searchParams.get("top");
    const topRaw = topParam ? Number.parseInt(topParam, 10) : 50;
    const top = Number.isFinite(topRaw) ? Math.min(Math.max(topRaw, 1), 200) : 50;

    const { result, metrics } = await captureGraphMetrics(async () => {
      // Find the underlying list item id for this asset
      const ids = await findListItemIdByAssetWithUserToken(token, assetNum);
      if (!ids) {
        return { versions: null };
      }

      // Acquire Graph token and fetch versions for the item
      const scopes = (process.env.GRAPH_SCOPES || "https://graph.microsoft.com/.default")
        .split(/[,\s]+/)
        .filter(Boolean);
      const graphToken = await acquireOboToken(token, scopes);
      const versions = await fetchListItemVersions(graphToken, ids.siteId, ids.listId, ids.itemId, top);
      return { versions };
    });

    const headers: HeadersInit = { "Cache-Control": "no-store" };
    if (process.env.DEBUG_GRAPH === "true" && metrics.length) {
      const totalRetries = metrics.reduce((acc, m) => acc + (m.retryCount || 0), 0);
      const totalDuration = metrics.reduce((acc, m) => acc + (m.durationMs || 0), 0);
      (headers as Record<string, string>)["X-Graph-Retries"] = String(totalRetries);
      (headers as Record<string, string>)["X-Graph-Duration"] = String(totalDuration);
    }

    if (!result?.versions) {
      return json({ error: "Asset not found" }, { status: 404, headers });
    }

    const events = computeAssetHistoryEvents(result.versions);
    return json(events, { status: 200, headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: "Failed to fetch asset history", detail: message }, { status: 500 });
  }
}
