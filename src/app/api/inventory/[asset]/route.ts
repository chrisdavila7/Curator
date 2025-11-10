import { NextRequest, NextResponse } from "next/server";
import {
  fetchInventoryItemByAssetWithUserToken,
  captureGraphMetrics,
  updateInventoryItemFieldsWithUserToken,
  deleteInventoryItemWithUserToken,
  GraphHttpError,
  findListItemIdByAssetWithUserToken,
  getListItemETag,
  invalidateModelsCache,
} from "@/lib/graph/sharepoint";
import { verifyApiAccessToken, acquireOboToken } from "@/lib/auth/msal-server";
import { ZInventoryPatchPayload } from "@/lib/validation/inventory";
import { FIELD_MAP } from "@/lib/mappers/inventory";

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

function toSpFieldPatch(domain: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(domain)) {
    const spKey = (FIELD_MAP as Record<string, string>)[k as keyof typeof FIELD_MAP];
    if (spKey && v !== undefined) out[spKey] = v;
  }
  return out;
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

    // Mock mode short-circuit
    if (process.env.USE_MOCK_INVENTORY === "true") {
      const { mockInventory } = await import("@/data/inventory");
      const found = mockInventory.find((i) => i.asset === assetNum);
      if (!found) {
        return json({ error: "Asset not found" }, {
          status: 404,
          headers: { "Cache-Control": "no-store" },
        });
      }
      return json(found, {
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

    const { result: found, metrics } = await captureGraphMetrics(() =>
      fetchInventoryItemByAssetWithUserToken(token, assetNum)
    );

    const headers: HeadersInit = { "Cache-Control": "no-store" };
    // Best-effort: resolve and attach current ETag for concurrency on first load
    try {
      const ids = await findListItemIdByAssetWithUserToken(token, assetNum);
      if (ids) {
        const scopes = (process.env.GRAPH_SCOPES || "https://graph.microsoft.com/.default")
          .split(/[,\s]+/)
          .filter(Boolean);
        const graphToken = await acquireOboToken(token, scopes);
        const { eTag } = await getListItemETag(graphToken, ids.siteId, ids.listId, ids.itemId);
        if (eTag) (headers as Record<string, string>)["ETag"] = eTag;
      }
    } catch {
      // ignore etag failure; response remains valid without it
    }
    if (process.env.DEBUG_GRAPH === "true" && metrics.length) {
      const totalRetries = metrics.reduce((acc, m) => acc + (m.retryCount || 0), 0);
      const totalDuration = metrics.reduce((acc, m) => acc + (m.durationMs || 0), 0);
      (headers as Record<string, string>)["X-Graph-Retries"] = String(totalRetries);
      (headers as Record<string, string>)["X-Graph-Duration"] = String(totalDuration);
    }

    if (!found) {
      return json({ error: "Asset not found" }, { status: 404, headers });
    }

    return json(found, { status: 200, headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: "Failed to fetch asset", detail: message }, { status: 500 });
  }
}

/**
 * PATCH /api/inventory/[asset]
 * Body: { fields: Partial<domain>, etag?: string }
 * - Maps domain keys to SharePoint internal keys and updates fields with If-Match.
 * - Returns { item, eTag } and sets ETag response header when available.
 */
export async function PATCH(
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

    // Parse payload
    let body: unknown = null;
    try {
      body = await req.json();
    } catch {
      // no body
    }
    const parsed = ZInventoryPatchPayload.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
      return json({ error: "Invalid payload", detail: msg }, { status: 400 });
    }
    const { fields, etag } = parsed.data;

    // Mock mode short-circuit
    if (process.env.USE_MOCK_INVENTORY === "true" || process.env.USE_MOCK_INVENTORY_WRITE === "true") {
      const { mockInventory } = await import("@/data/inventory");
      const idx = mockInventory.findIndex((i) => i.asset === assetNum);
      if (idx === -1) {
        return json({ error: "Asset not found" }, {
          status: 404,
          headers: { "Cache-Control": "no-store" },
        });
      }
      const current = mockInventory[idx];
      const updated = { ...current, ...fields };
      mockInventory[idx] = updated;
      try { invalidateModelsCache(); } catch {}
      return json({ item: updated, eTag: 'W/"mock"' }, {
        status: 200,
        headers: { "Cache-Control": "no-store", ETag: 'W/"mock"' },
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

    // Update fields with If-Match
    const spPatch = toSpFieldPatch(fields as Record<string, unknown>);
    try {
      const { eTag } = await updateInventoryItemFieldsWithUserToken(token, assetNum, spPatch, etag);
      // Invalidate model options cache if model was part of the update
      if (Object.prototype.hasOwnProperty.call(fields, "model")) {
        try {
          invalidateModelsCache();
        } catch {}
      }
      // Fetch updated item to return normalized domain object + latest eTag
      const found = await fetchInventoryItemByAssetWithUserToken(token, assetNum);
      if (!found) {
        return json({ error: "Asset not found after update" }, { status: 404, headers: { "Cache-Control": "no-store" } });
      }
      const headers: HeadersInit = { "Cache-Control": "no-store" };
      if (eTag) (headers as Record<string, string>)["ETag"] = eTag;
      return json({ item: found, eTag }, { status: 200, headers });
    } catch (e) {
      if (e instanceof GraphHttpError) {
        if (e.status === 412) {
          return json({ error: "Precondition Failed", detail: "ETag mismatch" }, { status: 412 });
        }
        return json({ error: `Graph error ${e.status}`, detail: e.body || "" }, { status: e.status });
      }
      if (e instanceof Error && /Asset not found/.test(e.message)) {
        return json({ error: "Asset not found" }, { status: 404 });
      }
      const detail = e instanceof Error ? e.message : "Unknown error";
      return json({ error: "Failed to update asset", detail }, { status: 500 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: "Failed to update asset", detail: message }, { status: 500 });
  }
}

/**
 * DELETE /api/inventory/[asset]
 * Body (optional): { etag?: string } or use If-Match header
 */
export async function DELETE(
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

    // Read etag from header or body
    let etag: string | undefined =
      req.headers.get("if-match") || req.headers.get("If-Match") || undefined;

    if (!etag) {
      try {
        const b = (await req.json()) as { etag?: string } | null;
        if (b?.etag) etag = b.etag;
      } catch {
        // ignore
      }
    }

    // Mock mode
    if (process.env.USE_MOCK_INVENTORY === "true" || process.env.USE_MOCK_INVENTORY_WRITE === "true") {
      const { mockInventory } = await import("@/data/inventory");
      const idx = mockInventory.findIndex((i) => i.asset === assetNum);
      if (idx === -1) {
        return json({ error: "Asset not found" }, {
          status: 404,
          headers: { "Cache-Control": "no-store" },
        });
      }
      mockInventory.splice(idx, 1);
      return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
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

    try {
      await deleteInventoryItemWithUserToken(token, assetNum, etag);
      return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    } catch (e) {
      if (e instanceof GraphHttpError) {
        if (e.status === 412) {
          return json({ error: "Precondition Failed", detail: "ETag mismatch" }, { status: 412 });
        }
        return json({ error: `Graph error ${e.status}`, detail: e.body || "" }, { status: e.status });
      }
      if (e instanceof Error && /Asset not found/.test(e.message)) {
        return json({ error: "Asset not found" }, { status: 404 });
      }
      const detail = e instanceof Error ? e.message : "Unknown error";
      return json({ error: "Failed to delete asset", detail }, { status: 500 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: "Failed to delete asset", detail: message }, { status: 500 });
  }
}
