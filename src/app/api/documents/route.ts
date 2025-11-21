import { NextRequest, NextResponse } from "next/server";
import { uploadPdfWithUserToken } from "@/lib/graph/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

function noStore(init?: ResponseInit): ResponseInit {
  const base = init || {};
  return {
    ...base,
    headers: {
      ...(base.headers || {}),
      "Cache-Control": "no-store",
    },
  };
}

function isSaveEnabled(): boolean {
  return process.env.ENABLE_SHAREPOINT_SAVE === "true";
}

function getAuthToken(req: NextRequest): string | undefined {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  const token = auth && auth.startsWith("Bearer ") ? auth.slice(7) : undefined;
  return token;
}

function getDefaultUploadFolder(): string {
  return process.env.UPLOAD_TARGET_FOLDER_PATH || "/Shared Documents";
}

/**
 * POST /api/documents
 * Accepts:
 * - application/octet-stream with query params: fileName, assetId?, templateKey?
 * - application/json with { fileName, assetId?, templateKey?, bytesBase64 }
 * Returns 201 with { id, webUrl?, eTag? } on success.
 */
export async function POST(req: NextRequest) {
  if (!isSaveEnabled()) {
    return json({ error: "Save to SharePoint is disabled" }, noStore({ status: 404 }));
  }

  const token = getAuthToken(req);
  if (!token) {
    return json({ error: "Missing Authorization" }, noStore({ status: 401 }));
  }

  const url = new URL(req.url);
  const contentType = (req.headers.get("content-type") || "").toLowerCase();

  let fileName: string | undefined;
  let assetId: string | undefined;
  let templateKey: string | undefined;
  let bytes: ArrayBuffer | undefined;

  try {
    if (contentType.startsWith("application/octet-stream")) {
      // Read metadata from query string
      fileName = url.searchParams.get("fileName") || undefined;
      assetId = url.searchParams.get("assetId") || undefined;
      templateKey = url.searchParams.get("templateKey") || undefined;

      // Raw bytes in body
      bytes = await req.arrayBuffer();
    } else if (contentType.startsWith("application/json")) {
      const body = (await req.json()) as
        | { fileName?: string; assetId?: string; templateKey?: string; bytesBase64?: string }
        | undefined;

      fileName = body?.fileName;
      assetId = body?.assetId;
      templateKey = body?.templateKey;

      const b64 = body?.bytesBase64 || "";
      if (b64) {
        const buf = Buffer.from(b64, "base64");
        // Normalize to a standalone ArrayBuffer slice
        bytes = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
      }
    } else {
      return json({ error: "Unsupported content-type" }, noStore({ status: 415 }));
    }
  } catch {
    return json({ error: "Invalid request body" }, noStore({ status: 400 }));
  }

  if (!fileName) {
    return json({ error: "Missing fileName" }, noStore({ status: 400 }));
  }
  if (!bytes) {
    return json({ error: "Missing PDF bytes" }, noStore({ status: 400 }));
  }

  const targetFolderPath = getDefaultUploadFolder();

  try {
    const result = await uploadPdfWithUserToken(token, {
      fileName,
      bytes,
      targetFolderPath,
      metadata: undefined,
      assetId,
      templateKey,
    });
    return json(result, noStore({ status: 201 }));
  } catch {
    return json({ error: "Upload failed" }, noStore({ status: 502 }));
  }
}
