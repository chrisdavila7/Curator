import { acquireOboToken } from "@/lib/auth/msal-server";
import { getSiteId } from "@/lib/graph/sharepoint";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

function getEnv(name: string, optional = false): string {
  const val = process.env[name];
  if (!val && !optional) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return val || "";
}

function getGraphScopes(): string[] {
  return (process.env.GRAPH_SCOPES || "https://graph.microsoft.com/.default")
    .split(/[,\s]+/)
    .filter(Boolean);
}

async function getGraphTokenForUser(userAccessToken: string): Promise<string> {
  const scopes = getGraphScopes();
  return acquireOboToken(userAccessToken, scopes);
}

type DriveItemChild = {
  id: string;
  name: string;
  file?: Record<string, unknown>;
  lastModifiedDateTime?: string;
};

type DriveChildrenResponse = {
  value: DriveItemChild[];
};

type DriveIdResponse = { id: string };

async function graphGetJson<T>(url: string, accessToken: string, headers?: HeadersInit): Promise<T> {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...(headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err: Error & { status?: number; body?: string } = new Error(`Graph GET ${res.status}: ${body || "unknown"}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return (await res.json()) as T;
}

async function graphGetArrayBuffer(url: string, accessToken: string, headers?: HeadersInit): Promise<ArrayBuffer> {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err: Error & { status?: number; body?: string } = new Error(`Graph GET ${res.status}: ${body || "unknown"}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return await res.arrayBuffer();
}

async function graphPostJson<T>(url: string, accessToken: string, body: unknown, headers?: HeadersInit): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(headers || {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    const err: Error & { status?: number; body?: string } = new Error(`Graph POST ${res.status}: ${txt || "unknown"}`);
    err.status = res.status;
    err.body = txt;
    throw err;
  }
  return (await res.json()) as T;
}

async function graphPatchRaw(url: string, accessToken: string, bytes: ArrayBuffer, rangeHeader: string): Promise<Response> {
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Length": String(bytes.byteLength),
      "Content-Range": rangeHeader,
    },
    body: bytes,
  });
  if (!res.ok && res.status !== 201 && res.status !== 200) {
    const txt = await res.text().catch(() => "");
    const err: Error & { status?: number; body?: string } = new Error(`Graph PATCH ${res.status}: ${txt || "unknown"}`);
    err.status = res.status;
    err.body = txt;
    throw err;
  }
  return res;
}

async function graphPutContent(url: string, accessToken: string, bytes: ArrayBuffer): Promise<Response> {
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/pdf",
      "Content-Length": String(bytes.byteLength),
    },
    body: bytes,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    const err: Error & { status?: number; body?: string } = new Error(`Graph PUT ${res.status}: ${txt || "unknown"}`);
    err.status = res.status;
    err.body = txt;
    throw err;
  }
  return res;
}

/**
 * The user provided a SharePoint UI link (AllItems.aspx with id param).
 * Convert a variety of inputs to a drive-relative folder path for Graph, e.g. "/Templates" or "/- Master Hand Receipts -".
 *
 * Rules:
 * - If value includes "AllItems.aspx" and "id=", decode the id param (which is a server-relative path)
 *   like "/sites/Inventory/Shared Documents/- Master Hand Receipts -", then strip "/sites/.../Shared Documents"
 *   and keep the remainder ("/- Master Hand Receipts -").
 * - If value starts with "/Shared Documents", strip that segment (retain remainder after it).
 * - Otherwise, return the value as-is (ensure leading "/").
 */
function normalizeTemplatesFolderPath(raw: string, sitePath: string): string {
  let v = String(raw || "").trim();
  if (!v) return "/Templates";

  // If it looks like an AllItems.aspx URL or path with query
  if (v.includes("AllItems.aspx") && v.includes("id=")) {
    // Extract id=... (server-relative path)
    const qIndex = v.indexOf("?");
    const search = qIndex >= 0 ? v.slice(qIndex + 1) : "";
    const params = new URLSearchParams(search);
    const idParam = params.get("id") || "";
    const decoded = decodeURIComponent(idParam);

    // Expect decoded like: "/sites/Inventory/Shared Documents/<folder>"
    const lower = decoded.toLowerCase();
    const sdIdx = lower.indexOf("/shared documents");
    if (sdIdx >= 0) {
      const after = decoded.slice(sdIdx + "/shared documents".length); // may be "" or "/<folder>"
      return after ? ensureLeadingSlash(after) : "/";
    }

    // Fallback: if starts with sitePath, strip it
    const siteLower = sitePath.toLowerCase();
    const siteIdx = lower.indexOf(siteLower);
    if (siteIdx === 0) {
      const remain = decoded.slice(sitePath.length);
      return ensureLeadingSlash(remain || "/");
    }
    return ensureLeadingSlash(decoded);
  }

  // If the path includes "/Shared Documents", strip up to that segment.
  const lower = v.toLowerCase();
  const sdIdx = lower.indexOf("/shared documents");
  if (sdIdx >= 0) {
    const after = v.slice(sdIdx + "/shared documents".length);
    return after ? ensureLeadingSlash(after) : "/";
  }

  return ensureLeadingSlash(v);
}

function normalizeTargetFolderPath(raw?: string): string {
  if (!raw) return "/";
  const v = String(raw).trim();
  if (!v) return "/";
  const lower = v.toLowerCase();
  const sdIdx = lower.indexOf("/shared documents");
  if (sdIdx >= 0) {
    const after = v.slice(sdIdx + "/shared documents".length);
    return after ? ensureLeadingSlash(after) : "/";
  }
  return ensureLeadingSlash(v);
}

function ensureLeadingSlash(p: string): string {
  if (!p) return "/";
  return p.startsWith("/") ? p : `/${p}`;
}

async function resolveDriveId(accessToken: string, siteId: string): Promise<string> {
  const explicit = process.env.SP_TEMPLATES_DRIVE_ID;
  if (explicit && explicit !== "auto") return explicit;

  // Optional: select a document library by name if provided
  const driveName = process.env.SP_TEMPLATES_DRIVE_NAME;
  if (driveName && driveName.trim().length > 0) {
    type DrivesList = { value: Array<{ id: string; name?: string }> };
    const listUrl = `${GRAPH_BASE}/sites/${encodeURIComponent(siteId)}/drives?$select=id,name`;
    const list = await graphGetJson<DrivesList>(listUrl, accessToken);
    const match = (list.value || []).find((d) => (d.name || "").toLowerCase() === driveName.toLowerCase());
    if (match?.id) return match.id;
    // fall through to default drive resolution if not found
  }

  // Default drive (typically "Documents" / "Shared Documents")
  const url = `${GRAPH_BASE}/sites/${encodeURIComponent(siteId)}/drive?$select=id`;
  const js = await graphGetJson<DriveIdResponse>(url, accessToken);
  if (!js?.id) {
    throw Object.assign(new Error("Default drive not found"), { status: 404 });
  }
  return js.id;
}

async function resolveFolderId(accessToken: string, driveId: string, folderPath: string): Promise<string> {
  const path = folderPath === "/" ? "" : folderPath; // root means drive root
  const url = path
    ? `${GRAPH_BASE}/drives/${encodeURIComponent(driveId)}/root:${encodeURI(path)}?$select=id`
    : `${GRAPH_BASE}/drives/${encodeURIComponent(driveId)}/root?$select=id`;
  const js = await graphGetJson<{ id: string }>(url, accessToken);
  if (!js?.id) {
    throw Object.assign(new Error("Templates folder not found"), { status: 404 });
  }
  return js.id;
}

export type TemplateListItem = {
  key: string;
  name: string;
  itemId: string;
  modified?: string;
  version?: string;
};

/**
 * List templates available in SharePoint using the current user's API access token (OBO to Graph).
 */
export async function listTemplatesWithUserToken(userAccessToken: string): Promise<TemplateListItem[]> {
  const accessToken = await getGraphTokenForUser(userAccessToken);

  const hostname = getEnv("SP_HOSTNAME");
  const sitePath = getEnv("SP_SITE_PATH");
  const siteId = await getSiteId(accessToken, hostname, sitePath);

  const driveId = await resolveDriveId(accessToken, siteId);

  const rawFolder = getEnv("SP_TEMPLATES_FOLDER_PATH", true) || "/Templates";
  const folderPath = normalizeTemplatesFolderPath(rawFolder, sitePath);
  const folderId = await resolveFolderId(accessToken, driveId, folderPath);

  const childrenUrl = `${GRAPH_BASE}/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(
    folderId
  )}/children?$select=id,name,file,lastModifiedDateTime`;
  const kids = await graphGetJson<DriveChildrenResponse>(childrenUrl, accessToken);

  const out: TemplateListItem[] = [];
  for (const it of kids?.value || []) {
    // Must be a file and .pdf
    if (!it.file) continue;
    if (!/\.pdf$/i.test(it.name)) continue;

    const key = it.name.replace(/\.pdf$/i, "");
    out.push({
      key,
      name: key, // display name can be refined; using key for now
      itemId: it.id,
      modified: it.lastModifiedDateTime,
    });
  }
  return out;
}

/**
 * Fetch template PDF bytes by key from SharePoint using the current user's API access token (OBO to Graph).
 * Returns an ArrayBuffer containing the PDF content.
 */
export async function getTemplateBytesWithUserToken(userAccessToken: string, key: string): Promise<ArrayBuffer> {
  const accessToken = await getGraphTokenForUser(userAccessToken);

  const hostname = getEnv("SP_HOSTNAME");
  const sitePath = getEnv("SP_SITE_PATH");
  const siteId = await getSiteId(accessToken, hostname, sitePath);

  const driveId = await resolveDriveId(accessToken, siteId);

  const rawFolder = getEnv("SP_TEMPLATES_FOLDER_PATH", true) || "/Templates";
  const folderPath = normalizeTemplatesFolderPath(rawFolder, sitePath);

  // Build a drive-relative path and URL-encode it correctly for Graph "root:{path}:/content"
  // Use encodeURI on the whole path (preserves slashes) to handle spaces in folder names like "- Master Hand Receipts -"
  const rawPath = folderPath === "/" ? `/${key}.pdf` : `${folderPath}/${key}.pdf`;
  const encodedPath = encodeURI(rawPath);
  const url = `${GRAPH_BASE}/drives/${encodeURIComponent(driveId)}/root:${encodedPath}:/content`;
  if (process.env.DEBUG_GRAPH === "true") {
    // Non-sensitive debug info to validate path resolution
    console.info("[GRAPH] getTemplateBytes path", {
      sitePath,
      driveId,
      folderPath,
      rawPath,
      url,
    });
  }

  try {
    return await graphGetArrayBuffer(url, accessToken, { Accept: "application/pdf" });
  } catch (e) {
    const ee = e as { status?: number };
    if (ee.status === 404) {
      // Try a few likely alternate folder paths before searching (handles folder name drift)
      try {
        const candidates = Array.from(
          new Set<string>([
            folderPath,
            "/Master Hand Receipt",
            "/- Master Hand Receipts -",
            "/Master Hand Receipts",
          ])
        ).filter(Boolean);

        for (const fp of candidates) {
          const altRaw = fp === "/" ? `/${key}.pdf` : `${fp}/${key}.pdf`;
          const altEncoded = encodeURI(altRaw);
          const altUrl = `${GRAPH_BASE}/drives/${encodeURIComponent(driveId)}/root:${altEncoded}:/content`;
          if (process.env.DEBUG_GRAPH === "true") {
            console.info("[GRAPH] 404 alt-path try", { altRaw, altUrl });
          }
          try {
            return await graphGetArrayBuffer(altUrl, accessToken, { Accept: "application/pdf" });
          } catch {
            // continue to next candidate
          }
        }
      } catch {
        // ignore and continue to search fallback
      }

      // Fallback: search the drive for a file named `${key}.pdf` (handles folder/path mismatches)
      try {
        type SearchResp = { value: Array<{ id: string; name: string; parentReference?: { path?: string } }> };
        const searchQ = encodeURIComponent(`${key}.pdf`);
        const searchUrl = `${GRAPH_BASE}/drives/${encodeURIComponent(driveId)}/root/search(q='${searchQ}')?$select=id,name,parentReference`;
        if (process.env.DEBUG_GRAPH === "true") {
          console.info("[GRAPH] 404 fallback: drive search", { driveId, searchUrl, key });
        }
        const results = await graphGetJson<SearchResp>(searchUrl, accessToken);
        const targetLower = `${key}.pdf`.toLowerCase().trim();
        const normalize = (n: string) => n.toLowerCase().replace(/\s+/g, " ").trim();
        // Prefer exact normalized match, else a startsWith/contains heuristic
        const match =
          (results.value || []).find((it) => normalize(it.name || "") === normalize(targetLower)) ||
          (results.value || []).find((it) => normalize(it.name || "").startsWith(normalize(key))) ||
          (results.value || []).find((it) => normalize(it.name || "").includes(normalize(key)));
        if (process.env.DEBUG_GRAPH === "true") {
          console.info("[GRAPH] 404 fallback: drive search results", {
            count: results.value?.length || 0,
            matched: match?.name,
            parent: match?.parentReference?.path,
          });
        }
        if (match?.id) {
          const contentUrl = `${GRAPH_BASE}/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(match.id)}/content`;
          return await graphGetArrayBuffer(contentUrl, accessToken, { Accept: "application/pdf" });
        }
      } catch {
        // ignore search errors and fall through to not found
      }

      // Cross-library fallback: search all site drives (handles when template is in a different document library)
      try {
        type DrivesList = { value: Array<{ id: string; name?: string }> };
        type SearchResp = { value: Array<{ id: string; name: string; parentReference?: { path?: string } }> };
        const drivesUrl = `${GRAPH_BASE}/sites/${encodeURIComponent(siteId)}/drives?$select=id,name`;
        const drives = await graphGetJson<DrivesList>(drivesUrl, accessToken);
        const normalize = (n: string) => n.toLowerCase().replace(/\s+/g, " ").trim();
        const keyLower = normalize(key);
        if (process.env.DEBUG_GRAPH === "true") {
          console.info("[GRAPH] 404 fallback: cross-drive search", {
            drivesCount: drives.value?.length || 0,
            siteId,
            key,
          });
        }
        for (const d of drives.value || []) {
          if (!d?.id) continue;
          if (d.id === driveId) continue; // skip already-searched drive
          const searchQ = encodeURIComponent(`${key}.pdf`);
          const sUrl = `${GRAPH_BASE}/drives/${encodeURIComponent(d.id)}/root/search(q='${searchQ}')?$select=id,name,parentReference`;
          const res = await graphGetJson<SearchResp>(sUrl, accessToken);
          const match =
            (res.value || []).find((it) => normalize(it.name || "") === normalize(`${key}.pdf`)) ||
            (res.value || []).find((it) => normalize(it.name || "").startsWith(keyLower)) ||
            (res.value || []).find((it) => normalize(it.name || "").includes(keyLower));
          if (process.env.DEBUG_GRAPH === "true") {
            console.info("[GRAPH] 404 fallback: cross-drive results", {
              driveId: d.id,
              driveName: d.name,
              count: res.value?.length || 0,
              matched: match?.name,
              parent: match?.parentReference?.path,
            });
          }
          if (match?.id) {
            const contentUrl = `${GRAPH_BASE}/drives/${encodeURIComponent(d.id)}/items/${encodeURIComponent(match.id)}/content`;
            return await graphGetArrayBuffer(contentUrl, accessToken, { Accept: "application/pdf" });
          }
        }
      } catch {
        // ignore and fall through
      }

      const err: Error & { status?: number } = new Error("Template not found");
      err.status = 404;
      throw err;
    }
    throw e;
  }
}

/**
 * Upload a generated PDF to SharePoint using the current user's API access token (OBO to Graph).
 * opts.bytes must be an ArrayBuffer.
 */
export async function uploadPdfWithUserToken(
  userAccessToken: string,
  opts: {
    fileName: string;
    bytes: ArrayBuffer;
    targetFolderPath?: string;
    metadata?: Record<string, unknown>;
    assetId?: string;
    templateKey?: string;
  }
): Promise<{ id: string; webUrl?: string; eTag?: string }> {
  const accessToken = await getGraphTokenForUser(userAccessToken);

  const hostname = getEnv("SP_HOSTNAME");
  const sitePath = getEnv("SP_SITE_PATH");
  const siteId = await getSiteId(accessToken, hostname, sitePath);
  const driveId = await resolveDriveId(accessToken, siteId);

  const folderPath = normalizeTargetFolderPath(opts.targetFolderPath || "/");
  const basePath =
    folderPath === "/" ? `/${encodeURIComponent(opts.fileName)}` : `${folderPath}/${encodeURIComponent(opts.fileName)}`;

  // Use upload session for files >= 4 MiB
  const size = opts.bytes.byteLength;
  const FOUR_MIB = 4 * 1024 * 1024;

  if (size >= FOUR_MIB) {
    type SessionResp = { uploadUrl: string };
    const createUrl = `${GRAPH_BASE}/drives/${encodeURIComponent(driveId)}/root:${basePath}:/createUploadSession`;
    const session = await graphPostJson<SessionResp>(createUrl, accessToken, {
      item: {
        "@microsoft.graph.conflictBehavior": "replace",
        name: opts.fileName,
      },
    });

    if (!session?.uploadUrl) {
      throw new Error("Failed to create upload session");
    }

    // Upload in chunks
    const chunkSize = 2 * 1024 * 1024; // 2 MiB
    const allBytes = new Uint8Array(opts.bytes);
    const total = allBytes.byteLength;

    let start = 0;
    let lastResp: Response | undefined = undefined;

    while (start < total) {
      const end = Math.min(start + chunkSize, total) - 1;
      const slice = allBytes.slice(start, end + 1);
      const ab = slice.buffer.slice(slice.byteOffset, slice.byteOffset + slice.byteLength);
      const range = `bytes ${start}-${end}/${total}`;
      lastResp = await graphPatchRaw(session.uploadUrl, accessToken, ab, range);
      start = end + 1;
    }

    if (!lastResp) {
      throw new Error("Upload failed (no response)");
    }
    // The final response should include driveItem in JSON
    try {
      const js = (await lastResp.json()) as { id?: string; webUrl?: string; "@microsoft.graph.downloadUrl"?: string; eTag?: string; etag?: string };
      const id = js?.id || "";
      const eTag = (js as unknown as { eTag?: string; etag?: string }).eTag || (js as unknown as { etag?: string }).etag;
      return { id, webUrl: js?.webUrl, eTag };
    } catch {
      return { id: "", webUrl: undefined, eTag: undefined };
    }
  }

  // Small file: simple PUT
  const putUrl = `${GRAPH_BASE}/drives/${encodeURIComponent(driveId)}/root:${basePath}:/content`;
  const res = await graphPutContent(putUrl, accessToken, opts.bytes);

  let id = "";
  let eTag: string | undefined;

  eTag = res.headers.get("ETag") || res.headers.get("Etag") || res.headers.get("etag") || undefined;
  try {
    const js = (await res.json()) as { id?: string; webUrl?: string };
    id = js?.id || "";
    return { id, webUrl: js?.webUrl, eTag };
  } catch {
    return { id, webUrl: undefined, eTag };
  }
}
