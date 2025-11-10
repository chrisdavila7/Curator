import { NextRequest, NextResponse } from "next/server";
import { verifyApiAccessToken } from "@/lib/auth/msal-server";

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

// Static locations list provided by the user (order preserved)
const LOCATIONS = [
  "Agency",
  "Billing",
  "Finance",
  "CTS/BLS Inventory",
  "CDS",
  "Austin",
  "Beaumont",
  "Dallas",
  "El Paso",
  "Fort Worth",
  "Henderson",
  "Houston",
  "Longview",
  "Odessa",
  "Temple",
] as const;

/**
 * GET /api/inventory/options/locations
 * Query:
 *  - search?: string (optional, case-insensitive substring filter)
 *  - top?: number (default all, max 200)
 * Response: { locations: string[] }
 */
export async function GET(req: NextRequest) {
  try {
    const search = (req.nextUrl.searchParams.get("search") || "").trim();
    const topParam = Number.parseInt(req.nextUrl.searchParams.get("top") || "0", 10);
    const hasTop = Number.isFinite(topParam) && topParam > 0;
    const top = Math.max(1, Math.min(hasTop ? topParam : LOCATIONS.length, 200));

    // For consistency with other endpoints, require auth unless mock mode is enabled
    if (!isMockEnabled()) {
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
    }

    let list = Array.from(LOCATIONS);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((loc) => loc.toLowerCase().includes(s));
    }
    if (hasTop) {
      list = list.slice(0, top);
    }
    return json({ locations: list }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: "Failed to fetch locations", detail: message }, { status: 500 });
  }
}
