import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { getTemplateBytesWithUserToken } from "@/lib/graph/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isMockEnabled(): boolean {
  return process.env.USE_MOCK_TEMPLATES === "true" || process.env.NEXT_PUBLIC_USE_MOCK_TEMPLATES === "true";
}

function notFound(): NextResponse {
  return new NextResponse(JSON.stringify({ error: "Template not found" }), {
    status: 404,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

async function generateMockPdfForKey(key: string): Promise<Uint8Array | null> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  page.drawText(`Template: ${key} (mock)`, { x: 170, y: 720, size: 10 });
  const form = pdfDoc.getForm();

  if (key === "asset-checkout-v1") {
    page.drawText("ASSET CHECKOUT", { x: 200, y: 740, size: 18 });
    const serial = form.createTextField("Asset.SerialNumber");
    serial.addToPage(page, { x: 200, y: 680, width: 200, height: 18 });
    page.drawText("Serial Number:", { x: 100, y: 683, size: 10 });

    const checkedOut = form.createCheckBox("Asset.CheckedOut");
    checkedOut.addToPage(page, { x: 200, y: 650, width: 12, height: 12 });
    page.drawText("Checked Out:", { x: 100, y: 649, size: 10 });
  } else if (key === "Yubikey Hand Receipt") {
    page.drawText("Yubikey Hand Receipt", { x: 180, y: 740, size: 16 });
    // Optional: create a couple of fields with common names (absence is fine for tests)
    try {
      form.createTextField("Employee 1").addToPage(page, { x: 180, y: 700, width: 220, height: 18 });
    } catch {}
    try {
      form.createTextField("Department/Location").addToPage(page, { x: 180, y: 670, width: 220, height: 18 });
    } catch {}
  } else if (key === "Blank Hand Receipt") {
    page.drawText("Blank Hand Receipt", { x: 180, y: 740, size: 16 });
    // Create some representative fields that our mapping expects.
    try {
      form.createTextField("Employee Name 1").addToPage(page, { x: 180, y: 700, width: 220, height: 18 });
    } catch {}
    try {
      form.createTextField("Date 1").addToPage(page, { x: 180, y: 680, width: 120, height: 18 });
    } catch {}
    try {
      form.createTextField("Asset Tag 1").addToPage(page, { x: 180, y: 660, width: 120, height: 18 });
    } catch {}
    try {
      form.createTextField("Asset Name/Model 1").addToPage(page, { x: 320, y: 660, width: 200, height: 18 });
    } catch {}
    try {
      form.createTextField("Serial Number 1").addToPage(page, { x: 180, y: 640, width: 200, height: 18 });
    } catch {}
    try {
      form.createTextField("Replacement Cost 1").addToPage(page, { x: 400, y: 640, width: 120, height: 18 });
    } catch {}
    try {
      form.createTextField("CTS Department Representative").addToPage(page, { x: 180, y: 620, width: 240, height: 18 });
    } catch {}
    try {
      form.createTextField("Date 3").addToPage(page, { x: 440, y: 620, width: 120, height: 18 });
    } catch {}
  } else {
    return null;
  }

  return pdfDoc.save();
}

/**
 * GET /api/templates/[key]
 * Response (200): application/pdf bytes
 * Headers: Cache-Control: no-store
 * 404 when key not found in mock mode
 */
export async function GET(_req: NextRequest, ctx: { params: { key: string } }) {
  // Next requires awaiting params in dynamic API routes
  const params = await (ctx as unknown as { params: Promise<{ key: string }> | { key: string } }).params;
  const key = (params as { key: string }).key;
  if (!key) return notFound();

  if (isMockEnabled()) {
    const bytes = await generateMockPdfForKey(key);
    if (!bytes) return notFound();

    const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    return new NextResponse(ab, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "no-store",
      },
    });
  }

  // Real provider: SharePoint via Microsoft Graph (OBO)
  const auth = _req.headers.get("authorization") || _req.headers.get("Authorization");
  const token = auth && auth.startsWith("Bearer ") ? auth.slice(7) : undefined;

  if (!token) {
    return new NextResponse(JSON.stringify({ error: "Missing Authorization" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  }

  try {
    const ab = await getTemplateBytesWithUserToken(token, key);
    return new NextResponse(ab, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const status = (e as { status?: number }).status || 502;
    if (status === 404) {
      return new NextResponse(JSON.stringify({ error: "Template not found" }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      });
    }
    return new NextResponse(JSON.stringify({ error: "Failed to fetch template" }), {
      status: 502,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  }
}
