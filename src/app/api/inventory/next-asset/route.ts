import { NextRequest, NextResponse } from "next/server";
import { getNextAssetWithUserToken } from "@/lib/graph/sharepoint";
import { verifyApiAccessToken } from "@/lib/auth/msal-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

/**
 * GET /api/inventory/next-asset
 * Returns { nextAsset: number }
 * - Mock mode: computes from mockInventory in-memory data
 * - Live mode: requires Authorization: Bearer & queries SharePoint field_1 (numeric) for highest, then +1
 */
export async function GET(req: NextRequest) {
  try {
    // Mock/dev mode: compute from mock dataset
    if (process.env.USE_MOCK_INVENTORY === "true" || process.env.NEXT_PUBLIC_USE_MOCK_INVENTORY === "true") {
      const { mockInventory } = await import("@/data/inventory");
      const nums = mockInventory.map((i) => Number(i.asset)).filter((n) => Number.isFinite(n));
      const max = nums.length ? Math.max(...nums) : 0;
      return json({ nextAsset: max + 1 }, { status: 200, headers: { "Cache-Control": "no-store" } });
    }

    // Live mode: require bearer token
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

    const nextAsset = await getNextAssetWithUserToken(token);
    return json({ nextAsset }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: "Failed to compute next asset", detail: message }, { status: 500 });
  }
}
