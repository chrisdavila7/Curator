import { NextRequest, NextResponse } from "next/server";
import {
  fetchInventoryItemsWithUserToken,
  fetchRecentInventoryActivityWithUserToken,
  fetchDeployedSinceWithUserToken,
  captureGraphMetrics,
  createInventoryItemWithUserToken,
  GraphHttpError,
  invalidateModelsCache,
} from "@/lib/graph/sharepoint";
import { verifyApiAccessToken } from "@/lib/auth/msal-server";
import { ZInventoryCreatePayload } from "@/lib/validation/inventory";
import { FIELD_MAP } from "@/lib/mappers/inventory";
import { startOfUtcDay, startOfUtcIsoWeek, startOfUtcMonth } from "@/lib/date-utc";

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




function toSpFieldCreate(domain: Record<string, unknown>): Record<string, unknown> {
  // Map domain keys to SharePoint internal field names using FIELD_MAP.
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(domain)) {
    const spKey = (FIELD_MAP as Record<string, string>)[k as keyof typeof FIELD_MAP];
    if (!spKey || v === undefined) continue;
    // SharePoint Title is string; coerce asset to string
    if (spKey === "Title") {
      out[spKey] = String(v);
    } else {
      out[spKey] = v;
    }
  }
  return out;
}

export async function GET(req: NextRequest) {
  try {
    const recentParam = req.nextUrl.searchParams.get("recent");
    const recent = recentParam ? Number.parseInt(recentParam, 10) : NaN;
    const deployedSinceKey = (req.nextUrl.searchParams.get("deployedSince") || "").toLowerCase();

    // Dev fallback: allow serving mock data without auth when explicitly enabled
    if (process.env.USE_MOCK_INVENTORY === "true") {
      const { mockInventory } = await import("@/data/inventory");

      if (deployedSinceKey === "week" || deployedSinceKey === "month" || deployedSinceKey === "today") {
        const now = new Date();
        const since =
          deployedSinceKey === "week"
            ? startOfUtcIsoWeek(now)
            : deployedSinceKey === "month"
            ? startOfUtcMonth(now)
            : startOfUtcDay(now);
        const sinceMs = since.getTime();
        const filtered = [...mockInventory]
          .filter((i) => i.status === "deployed")
          .filter((i) => new Date(i.modified || i.created).getTime() >= sinceMs)
          .sort((a, b) => {
            const ad = new Date(a.modified || a.created).getTime();
            const bd = new Date(b.modified || b.created).getTime();
            return bd - ad;
          });
        return json(filtered, {
          status: 200,
          headers: { "Cache-Control": "no-store" },
        });
      }

      if (Number.isFinite(recent) && recent > 0) {
        const sorted = [...mockInventory].sort((a, b) => {
          const ad = new Date(a.modified || a.created).getTime();
          const bd = new Date(b.modified || b.created).getTime();
          return bd - ad;
        });
        return json(sorted.slice(0, recent), {
          status: 200,
          headers: { "Cache-Control": "no-store" },
        });
      }

      return json(mockInventory, {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const token = getBearerToken(req);
    if (!token) {
      return json({ error: "Missing Authorization: Bearer <token>" }, { status: 401 });
    }

    // Optional JWT verification against tenant JWKS and expected audience
    if (process.env.AZURE_VERIFY_JWT === "true") {
      try {
        await verifyApiAccessToken(token);
      } catch (e) {
        return json({ error: "Invalid or unauthorized token" }, { status: 401 });
      }
    }

    if (deployedSinceKey === "week" || deployedSinceKey === "month" || deployedSinceKey === "today") {
      const now = new Date();
      const since =
        deployedSinceKey === "week"
          ? startOfUtcIsoWeek(now)
          : deployedSinceKey === "month"
          ? startOfUtcMonth(now)
          : startOfUtcDay(now);
      const { result: items, metrics } = await captureGraphMetrics(() =>
        fetchDeployedSinceWithUserToken(token, since)
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
    } else if (Number.isFinite(recent) && recent > 0) {
      const { result: items, metrics } = await captureGraphMetrics(() =>
        fetchRecentInventoryActivityWithUserToken(token, recent)
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
    } else {
      const { result: items, metrics } = await captureGraphMetrics(() =>
        fetchInventoryItemsWithUserToken(token)
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
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: "Failed to fetch inventory", detail: message }, { status: 500 });
  }
}

/**
 * POST /api/inventory
 * Body: { fields: { asset, userLocation, status, serial, model, assetImage?, notes? } }
 * Creates a new SharePoint list item (as the user) and returns minimal info.
 */
export async function POST(req: NextRequest) {
  try {
    // Parse and validate
    let body: unknown = null;
    try {
      body = await req.json();
    } catch {
      // no body
    }
    const parsed = ZInventoryCreatePayload.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
      return json({ error: "Invalid payload", detail: msg }, { status: 400 });
    }
    const { fields } = parsed.data;

    // Mock mode create
    if (process.env.USE_MOCK_INVENTORY === "true" || process.env.USE_MOCK_INVENTORY_WRITE === "true") {
      const { mockInventory } = await import("@/data/inventory");
      const exists = mockInventory.some((i) => i.asset === fields.asset);
      if (exists) {
        return json({ error: "Asset already exists" }, { status: 409 });
      }
      const now = new Date().toISOString().slice(0, 10);
      const created = {
        asset: fields.asset,
        userLocation: fields.userLocation,
        status: fields.status,
        serial: fields.serial,
        model: fields.model,
        assetImage: fields.assetImage || "",
        notes: fields.notes || "",
        modified: now,
        modifiedBy: "Mock User",
        created: now,
        createdBy: "Mock User",
      };
      mockInventory.push(created);
      try { invalidateModelsCache(); } catch {}
      return json({ item: created, eTag: 'W/"mock"' }, {
        status: 201,
        headers: { "Cache-Control": "no-store", ETag: 'W/"mock"' },
      });
    }

    // Live mode: require bearer token
    const token = (req.headers.get("authorization") || req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
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

    const spFields = toSpFieldCreate(fields as Record<string, unknown>);
    try {
      const { id, eTag } = await createInventoryItemWithUserToken(token, spFields);
      // Invalidate model options cache if a model was provided on create
      try {
        if (fields.model) {
          invalidateModelsCache();
        }
      } catch {}
      // Optionally fetch the full item to return the normalized domain shape
      // For now, respond with minimal ack; caller can refetch list or item by asset number.
      const headers: HeadersInit = { "Cache-Control": "no-store" };
      if (eTag) (headers as Record<string, string>)["ETag"] = eTag;
      return json({ id, eTag }, { status: 201, headers });
    } catch (e) {
      if (e instanceof GraphHttpError) {
        return json({ error: `Graph error ${e.status}`, detail: e.body || "" }, { status: e.status });
      }
      const detail = e instanceof Error ? e.message : "Unknown error";
      return json({ error: "Failed to create item", detail }, { status: 500 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: "Failed to create item", detail: message }, { status: 500 });
  }
}
