import { NextRequest, NextResponse } from "next/server";
import { listTemplatesWithUserToken } from "@/lib/graph/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

function isMockEnabled(): boolean {
  return process.env.USE_MOCK_TEMPLATES === "true" || process.env.NEXT_PUBLIC_USE_MOCK_TEMPLATES === "true";
}

/**
 * GET /api/templates
 * Response (200): { templates: Array<{ key: string; name: string }> }
 * Headers: Cache-Control: no-store
 *
 * Mock mode returns a static list. Non-mock (real) mode is not yet implemented (501).
 */
export async function GET(_req: NextRequest) {
  if (isMockEnabled()) {
    const templates = [
      { key: "asset-checkout-v1", name: "Asset Checkout v1" },
      // Add more mock templates here as needed
    ];
    return json({ templates }, { status: 200, headers: { "Cache-Control": "no-store" } });
  }

  // Real provider: SharePoint via Microsoft Graph (OBO)
  const auth = _req.headers.get("authorization") || _req.headers.get("Authorization");
  const token = auth && auth.startsWith("Bearer ") ? auth.slice(7) : undefined;

  if (!token) {
    return json(
      { error: "Missing Authorization" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const templates = await listTemplatesWithUserToken(token);
    return json({ templates }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch {
    return json(
      { error: "Failed to fetch templates" },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
