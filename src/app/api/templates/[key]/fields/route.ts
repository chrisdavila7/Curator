import { NextRequest, NextResponse } from "next/server";
import { getTemplateBytesWithUserToken } from "@/lib/graph/templates";
import { PDFDocument } from "pdf-lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

function isMockEnabled(): boolean {
  return process.env.USE_MOCK_TEMPLATES === "true" || process.env.NEXT_PUBLIC_USE_MOCK_TEMPLATES === "true";
}

/**
 * GET /api/templates/[key]/fields
 * Response (200): { fields: string[] }
 * Headers: Cache-Control: no-store
 *
 * In non-mock mode, fetches the template via Graph (OBO) and enumerates AcroForm field names.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: { key: string } | Promise<{ key: string }> }
) {
  const noStore = { "Cache-Control": "no-store" as const };

  if (isMockEnabled()) {
    // No-op in mock mode (we don't have a real template to inspect)
    return json({ fields: [] }, { status: 200, headers: noStore });
  }

  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  const token = auth && auth.startsWith("Bearer ") ? auth.slice(7) : undefined;

  if (!token) {
    return json({ error: "Missing Authorization" }, { status: 401, headers: noStore });
  }

  const params = await (ctx as unknown as { params: Promise<{ key: string }> | { key: string } }).params;
  const key = (params as { key: string }).key || "";
  if (!key) {
    return json({ error: "Missing key" }, { status: 400, headers: noStore });
  }

  try {
    const ab = await getTemplateBytesWithUserToken(token, key);
    const bytes = ab instanceof Uint8Array ? ab : new Uint8Array(ab);
    const pdfDoc = await PDFDocument.load(bytes);

    let fields: string[] = [];
    try {
      const form = pdfDoc.getForm();
      const fs = form.getFields();
      fields = fs.map((f) => f.getName());
    } catch {
      fields = [];
    }

    return json({ fields }, { status: 200, headers: noStore });
  } catch {
    return json({ error: "Failed to enumerate fields" }, { status: 502, headers: noStore });
  }
}
