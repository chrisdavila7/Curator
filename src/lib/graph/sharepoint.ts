import { LRUCache } from "lru-cache";
import type { InventoryItem } from "@/types/inventory";
import {
  SP_FIELDS_SELECT,
  mapGraphListItemToInventory,
  type GraphListItem as SysGraphListItem,
  FIELD_MAP,
  type DomainField,
} from "@/lib/mappers/inventory";
import { acquireOboToken } from "@/lib/auth/msal-server";

function getEnv(name: string, optional = false): string {
  const val = process.env[name];
  if (!val && !optional) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return val || "";
}

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

// Observability types and callback
export interface GraphRequestMetric {
  url: string;
  status: number;
  attempts: number;      // total tries for this call
  retryCount: number;    // 429/503 retries
  durationMs: number;    // total elapsed time for final outcome
  fromCache?: boolean;   // optional flag when cache is used (site/list ids or deployedSince)
  method: "GET";
  timestamp: string;     // ISO
}

let graphMetricsCallback: ((m: GraphRequestMetric) => void) | undefined;

/**
 * Register a callback to receive metrics for Graph GET requests.
 * Pass undefined to clear.
 */
export function setGraphMetricsCallback(cb?: (m: GraphRequestMetric) => void): void {
  graphMetricsCallback = cb;
}

/**
 * Capture Graph metrics for the duration of the provided async function.
 * Restores any previous callback afterward.
 */
export async function captureGraphMetrics<T>(
  fn: () => Promise<T>
): Promise<{ result: T; metrics: GraphRequestMetric[] }> {
  const prev = graphMetricsCallback;
  const metrics: GraphRequestMetric[] = [];
  graphMetricsCallback = (m) => metrics.push(m);
  try {
    const result = await fn();
    return { result, metrics };
  } finally {
    graphMetricsCallback = prev;
  }
}

// Basic sleep helper
function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

function parseRetryAfter(headerVal: string | null): number {
  if (!headerVal) return 1000; // default 1s
  // If integer seconds
  const seconds = Number.parseInt(headerVal, 10);
  if (!Number.isNaN(seconds)) return Math.min(Math.max(seconds, 1), 60) * 1000;
  // HTTP-date
  const when = new Date(headerVal).getTime();
  const delta = when - Date.now();
  if (Number.isNaN(when) || delta <= 0) return 1000;
  return Math.min(delta, 60_000);
}

// Jittered exponential backoff (when Retry-After is absent)
function backoffDelay(attempt: number): number {
  const base = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s, 8s, ...
  const jitter = Math.floor(Math.random() * 250); // 0..250ms
  return Math.min(base + jitter, 60_000);
}

const MAX_RETRIES = Number.parseInt(process.env.GRAPH_MAX_RETRIES || "3", 10);

/**
 * Graph GET with retry/backoff and metrics emission.
 * - Honors Retry-After when present
 * - Otherwise uses jittered exponential backoff
 * - Emits GraphRequestMetric to an optional callback
 */
async function graphGet<T>(url: string, accessToken: string, extraHeaders?: HeadersInit): Promise<T> {
  const started = Date.now();
  let attempt = 0;
  let retryCount = 0;
  let lastErr: unknown;
  let lastStatus = 0;

  while (attempt <= MAX_RETRIES) {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        ...(extraHeaders || {}),
      },
    });

    lastStatus = res.status;

    if (res.ok) {
      const durationMs = Date.now() - started;
      const json = (await res.json()) as T;

      if (graphMetricsCallback) {
        graphMetricsCallback({
          url,
          status: res.status,
          attempts: attempt + 1,
          retryCount,
          durationMs,
          method: "GET",
          timestamp: new Date().toISOString(),
        });
      } else if (process.env.DEBUG_GRAPH === "true") {
        // minimal debug to aid diagnostics without spamming logs
        // eslint-disable-next-line no-console
        console.debug("Graph GET ok", { status: res.status, attempts: attempt + 1, retryCount, durationMs, url });
      }

      return json;
    }

    if (res.status === 429 || res.status === 503) {
      if (attempt === MAX_RETRIES) {
        lastErr = new Error(`Graph ${res.status}: exceeded retries`);
        break;
      }
      retryCount++;
      const ra = res.headers.get("Retry-After");
      const delay = ra ? parseRetryAfter(ra) : backoffDelay(attempt);
      await sleep(delay);
      attempt++;
      continue;
    }

    const text = await res.text();
    const durationMs = Date.now() - started;

    if (graphMetricsCallback) {
      graphMetricsCallback({
        url,
        status: res.status,
        attempts: attempt + 1,
        retryCount,
        durationMs,
        method: "GET",
        timestamp: new Date().toISOString(),
      });
    } else if (process.env.DEBUG_GRAPH === "true") {
      // eslint-disable-next-line no-console
      console.debug("Graph GET error", { status: res.status, attempts: attempt + 1, retryCount, durationMs, url });
    }

    throw new Error(`Graph error ${res.status}: ${text}`);
  }

  const durationMs = Date.now() - started;

  if (graphMetricsCallback) {
    graphMetricsCallback({
      url,
      status: lastStatus || 0,
      attempts: attempt + 1,
      retryCount,
      durationMs,
      method: "GET",
      timestamp: new Date().toISOString(),
    });
  } else if (process.env.DEBUG_GRAPH === "true") {
    // eslint-disable-next-line no-console
    console.debug("Graph GET failed", { status: lastStatus, attempts: attempt + 1, retryCount, durationMs, url });
  }

  throw lastErr || new Error("Graph request failed");
}

// Caches (optional)
const ttlMs = Number.parseInt(process.env.CACHE_TTL_SECONDS || "0", 10) * 1000;
const idTtlMs = Number.parseInt(process.env.CACHE_ID_TTL_SECONDS || "300", 10) * 1000;

const siteIdCache = new LRUCache<string, string>({ max: 100, ttl: idTtlMs });
const listIdCache = new LRUCache<string, string>({ max: 200, ttl: idTtlMs });
const itemsCache = new LRUCache<string, InventoryItem[]>({ max: 20, ttl: ttlMs });
const deployedTtlMs = Number.parseInt(process.env.DEPLOYED_CACHE_TTL_SECONDS || "60", 10) * 1000;
const deployedSinceCache = new LRUCache<string, InventoryItem[]>({ max: 20, ttl: deployedTtlMs });
const deployedAtTtlMs = Number.parseInt(process.env.DEPLOYED_AT_TTL_SECONDS || "300", 10) * 1000;
const deployedAtCache = new LRUCache<string, string>({ max: 1000, ttl: deployedAtTtlMs });

// Types for list items payload
type GraphListItemRaw = SysGraphListItem & {
  fields?: Record<string, unknown>;
};

// Tunables for performance
const DEPLOYED_PAGE_SIZE = Number.parseInt(process.env.DEPLOYED_PAGE_SIZE || "50", 10);
const DEPLOYED_CONCURRENCY = Number.parseInt(process.env.DEPLOYED_CONCURRENCY || "10", 10);
const DEPLOYED_MAX_RESULTS = Number.parseInt(process.env.DEPLOYED_MAX_RESULTS || "50", 10);

type GraphListItemsResponse = {
  value: GraphListItemRaw[];
  "@odata.nextLink"?: string;
};

export async function getSiteId(
  accessToken: string,
  hostname: string,
  sitePath: string
): Promise<string> {
  const key = `${hostname}:${sitePath}`;
  const cached = siteIdCache.get(key);
  if (cached) return cached;

  const siteUrl = `${GRAPH_BASE}/sites/${encodeURIComponent(hostname)}:${encodeURI(
    sitePath.startsWith("/") ? sitePath : `/${sitePath}`
  )}?$select=id`;
  const json = await graphGet<{ id: string }>(siteUrl, accessToken);
  const id = json?.id as string | undefined;
  if (!id) throw new Error("Site not found or missing id");
  siteIdCache.set(key, id);
  return id;
}

export async function getListId(
  accessToken: string,
  siteId: string,
  listNameOrId: string
): Promise<string> {
  const key = `${siteId}:${listNameOrId}`;
  const cached = listIdCache.get(key);
  if (cached) return cached;

  const listUrl = `${GRAPH_BASE}/sites/${encodeURIComponent(siteId)}/lists/${encodeURIComponent(
    listNameOrId
  )}?$select=id`;
  const json = await graphGet<{ id: string }>(listUrl, accessToken);
  const id = json?.id as string | undefined;
  if (!id) throw new Error("List not found or missing id");
  listIdCache.set(key, id);
  return id;
}

export async function fetchListItemsPage(params: {
  accessToken: string;
  siteId: string;
  listId: string;
  top?: number;
  skiptoken?: string;
}): Promise<{ items: GraphListItemRaw[]; nextLink?: string }> {
  const { accessToken, siteId, listId, top = 100, skiptoken } = params;

  const select = "id,createdDateTime,lastModifiedDateTime,createdBy,lastModifiedBy";
  const expand = `fields($select=${SP_FIELDS_SELECT})`;

  const searchParams = new URLSearchParams();
  searchParams.set("$top", String(top));
  searchParams.set("$select", select);
  searchParams.set("$expand", expand);
  if (skiptoken) searchParams.set("$skiptoken", skiptoken);

  const url = `${GRAPH_BASE}/sites/${encodeURIComponent(
    siteId
  )}/lists/${encodeURIComponent(listId)}/items?${searchParams.toString()}`;

  const json = await graphGet<GraphListItemsResponse>(url, accessToken, {
    Prefer: "HonorNonIndexedQueriesWarningMayFailRandomly",
  });
  const items = json?.value ?? [];
  const nextLink = json?.["@odata.nextLink"];
  return { items, nextLink };
}

export async function fetchAllListItems(
  accessToken: string,
  siteId: string,
  listId: string
): Promise<GraphListItemRaw[]> {
  let all: GraphListItemRaw[] = [];
  let next: string | undefined = undefined;

  const first = await fetchListItemsPage({ accessToken, siteId, listId, top: 100 });
  all = all.concat(first.items);
  next = first.nextLink;

  while (next) {
    // next contains the full URL including skiptoken
    const json = await graphGet<GraphListItemsResponse>(next, accessToken);
    all = all.concat(json?.value ?? []);
    next = json?.["@odata.nextLink"];
  }
  return all;
}

/**
 * End-to-end: Fetch inventory items using a Graph access token.
 * Applies mapping and validation.
 */
export async function fetchInventoryItems(accessToken: string): Promise<InventoryItem[]> {
  const hostname = getEnv("SP_HOSTNAME");
  const sitePath = getEnv("SP_SITE_PATH");
  const listIdOrName = getEnv("SP_LIST_ID_OR_NAME");

  const cacheKey = `${hostname}|${sitePath}|${listIdOrName}`;
  if (ttlMs > 0) {
    const cached = itemsCache.get(cacheKey);
    if (cached) return cached;
  }

  const siteId = await getSiteId(accessToken, hostname, sitePath);
  const listId = await getListId(accessToken, siteId, listIdOrName);
  const listItems = await fetchAllListItems(accessToken, siteId, listId);

  const items: InventoryItem[] = [];
  for (const li of listItems) {
    try {
      items.push(mapGraphListItemToInventory(li.fields ?? {}, li));
    } catch (e) {
      // Skip invalid items; optionally log
      // console.warn("Skipping invalid list item", li.id, e);
    }
  }

  if (ttlMs > 0) {
    itemsCache.set(cacheKey, items);
  }
  return items;
}

/**
 * Convenience helper that accepts a user access token for this API,
 * performs OBO to acquire a Graph token, and then fetches inventory items.
 */
export async function fetchInventoryItemsWithUserToken(userAccessToken: string): Promise<InventoryItem[]> {
  const scopes = (process.env.GRAPH_SCOPES || "https://graph.microsoft.com/.default")
    .split(/[,\s]+/)
    .filter(Boolean);
  const graphToken = await acquireOboToken(userAccessToken, scopes);
  return fetchInventoryItems(graphToken);
}

/**
 * Fetch a single inventory item by asset number using Graph $filter to avoid full list fetch.
 * Returns null when not found.
 */
export async function fetchInventoryItemByAsset(
  accessToken: string,
  assetNumber: number
): Promise<InventoryItem | null> {
  const hostname = getEnv("SP_HOSTNAME");
  const sitePath = getEnv("SP_SITE_PATH");
  const listIdOrName = getEnv("SP_LIST_ID_OR_NAME");

  const siteId = await getSiteId(accessToken, hostname, sitePath);
  const listId = await getListId(accessToken, siteId, listIdOrName);

  const select = "id,createdDateTime,lastModifiedDateTime,createdBy,lastModifiedBy";
  const expand = `fields($select=${SP_FIELDS_SELECT})`;
  // Asset is mapped to SharePoint "Title" (string) by FIELD_MAP.asset
  const filter = `fields/${FIELD_MAP.asset} eq '${String(assetNumber)}'`;

  const sp = new URLSearchParams();
  sp.set("$top", "1");
  sp.set("$select", select);
  sp.set("$expand", expand);
  sp.set("$filter", filter);

  const url = `${GRAPH_BASE}/sites/${encodeURIComponent(
    siteId
  )}/lists/${encodeURIComponent(listId)}/items?${sp.toString()}`;

  const json = await graphGet<GraphListItemsResponse>(url, accessToken, {
    Prefer: "HonorNonIndexedQueriesWarningMayFailRandomly",
  });
  const raw = (json?.value ?? [])[0];
  if (!raw) return null;
  try {
    return mapGraphListItemToInventory(raw.fields ?? {}, raw);
  } catch {
    return null;
  }
}

/**
 * OBO wrapper to fetch a single inventory item by asset number.
 */
export async function fetchInventoryItemByAssetWithUserToken(
  userAccessToken: string,
  assetNumber: number
): Promise<InventoryItem | null> {
  const scopes = (process.env.GRAPH_SCOPES || "https://graph.microsoft.com/.default")
    .split(/[,\s]+/)
    .filter(Boolean);
  const graphToken = await acquireOboToken(userAccessToken, scopes);
  return fetchInventoryItemByAsset(graphToken, assetNumber);
}

/**
 * Resolve siteId/listId/itemId for an asset number using a filtered query.
 * Returns null if not found.
 */
export async function findListItemIdByAssetWithUserToken(
  userAccessToken: string,
  assetNumber: number
): Promise<{ siteId: string; listId: string; itemId: string } | null> {
  const scopes = (process.env.GRAPH_SCOPES || "https://graph.microsoft.com/.default")
    .split(/[,\s]+/)
    .filter(Boolean);
  const accessToken = await acquireOboToken(userAccessToken, scopes);

  const hostname = getEnv("SP_HOSTNAME");
  const sitePath = getEnv("SP_SITE_PATH");
  const listIdOrName = getEnv("SP_LIST_ID_OR_NAME");

  const siteId = await getSiteId(accessToken, hostname, sitePath);
  const listId = await getListId(accessToken, siteId, listIdOrName);

  const sp = new URLSearchParams();
  sp.set("$top", "1");
  sp.set("$select", "id");
  sp.set("$filter", `fields/${FIELD_MAP.asset} eq '${String(assetNumber)}'`);

  const url = `${GRAPH_BASE}/sites/${encodeURIComponent(
    siteId
  )}/lists/${encodeURIComponent(listId)}/items?${sp.toString()}`;

  const json = await graphGet<{ value: { id: string }[] }>(url, accessToken, {
    Prefer: "HonorNonIndexedQueriesWarningMayFailRandomly",
  });
  const raw = (json?.value ?? [])[0];
  if (!raw?.id) return null;
  return { siteId, listId, itemId: raw.id };
}

/**
 * Search inventory items by asset number prefix using Graph $filter startswith on SharePoint Title (mapped from "asset").
 * Returns up to "top" results mapped to InventoryItem.
 */
export async function searchInventoryByAssetPrefix(
  accessToken: string,
  prefix: string,
  top = 10
): Promise<InventoryItem[]> {
  const hostname = getEnv("SP_HOSTNAME");
  const sitePath = getEnv("SP_SITE_PATH");
  const listIdOrName = getEnv("SP_LIST_ID_OR_NAME");

  // sanitize to digits for asset number prefix
  const pfx = String(prefix || "").trim().replace(/[^0-9]/g, "");
  if (!pfx) return [];

  const siteId = await getSiteId(accessToken, hostname, sitePath);
  const listId = await getListId(accessToken, siteId, listIdOrName);

  const select = "id,createdDateTime,lastModifiedDateTime,createdBy,lastModifiedBy";
  const expand = `fields($select=${SP_FIELDS_SELECT})`;

  const sp = new URLSearchParams();
  sp.set("$top", String(Math.max(1, Math.min(top || 10, 50))));
  sp.set("$select", select);
  sp.set("$expand", expand);
  // Use FIELD_MAP.asset which is "Title" per mapping
  // Escape single quotes in prefix for OData
  const safe = pfx.replace(/'/g, "''");
  sp.set("$filter", `startswith(fields/${FIELD_MAP.asset},'${safe}')`);
  sp.set("$orderby", "lastModifiedDateTime desc");

  const url = `${GRAPH_BASE}/sites/${encodeURIComponent(
    siteId
  )}/lists/${encodeURIComponent(listId)}/items?${sp.toString()}`;

  try {
    const json = await graphGet<GraphListItemsResponse>(url, accessToken, {
      // Correct Prefer header for non-indexed queries in SharePoint via Graph
      Prefer: "HonorNonIndexedQueriesWarning=true",
    });
    const raw = json?.value ?? [];
    const out: InventoryItem[] = [];
    for (const li of raw) {
      try {
        out.push(mapGraphListItemToInventory(li.fields ?? {}, li));
      } catch {
        // skip invalid item
      }
    }
    return out;
  } catch {
    // Fallback: scan first page and filter client-side by Title prefix
    try {
      const { items } = await fetchListItemsPage({ accessToken, siteId, listId, top: 200 });
      const filtered = items
        .filter((li) => {
          const f = (li.fields || {}) as Record<string, unknown>;
          const raw = f[FIELD_MAP.asset];
          const title = typeof raw === "string" || typeof raw === "number" ? String(raw) : "";
          return title.startsWith(pfx);
        })
        .slice(0, Math.max(1, Math.min(top || 10, 50)));
      const out: InventoryItem[] = [];
      for (const li of filtered) {
        try {
          out.push(mapGraphListItemToInventory(li.fields ?? {}, li));
        } catch {
          // skip invalid
        }
      }
      return out;
    } catch {
      return [];
    }
  }
}

/**
 * OBO wrapper to search by asset prefix using the current user's API token.
 */
export async function searchInventoryByAssetPrefixWithUserToken(
  userAccessToken: string,
  prefix: string,
  top = 10
): Promise<InventoryItem[]> {
  const scopes = (process.env.GRAPH_SCOPES || "https://graph.microsoft.com/.default")
    .split(/[,\s]+/)
    .filter(Boolean);
  const graphToken = await acquireOboToken(userAccessToken, scopes);
  return searchInventoryByAssetPrefix(graphToken, prefix, top);
}

/**
 * Recent activity (latest items by lastModifiedDateTime) with per-row latest changed domain field dot.
 */
export type GraphListItemVersion = {
  lastModifiedDateTime?: string;
  lastModifiedBy?: { user?: { displayName?: string | null } | null } | null;
  fields?: Record<string, unknown>;
};

async function fetchRecentListItems(
  accessToken: string,
  siteId: string,
  listId: string,
  top: number
): Promise<GraphListItemRaw[]> {
  const select = "id,createdDateTime,lastModifiedDateTime,createdBy,lastModifiedBy";
  const expand = `fields($select=${SP_FIELDS_SELECT})`;

  const searchParams = new URLSearchParams();
  searchParams.set("$top", String(top));
  searchParams.set("$select", select);
  searchParams.set("$expand", expand);
  searchParams.set("$orderby", "lastModifiedDateTime desc");

  const url = `${GRAPH_BASE}/sites/${encodeURIComponent(
    siteId
  )}/lists/${encodeURIComponent(listId)}/items?${searchParams.toString()}`;

  const json = await graphGet<GraphListItemsResponse>(url, accessToken);
  return json?.value ?? [];
}

export async function fetchListItemVersions(
  accessToken: string,
  siteId: string,
  listId: string,
  itemId: string,
  top = 5
): Promise<GraphListItemVersion[]> {
  const expand = `fields($select=${SP_FIELDS_SELECT})`;
  const select = "lastModifiedDateTime,lastModifiedBy";
  const url = `${GRAPH_BASE}/sites/${encodeURIComponent(siteId)}/lists/${encodeURIComponent(
    listId
  )}/items/${encodeURIComponent(
    itemId
  )}/versions?$top=${top}&$expand=${encodeURIComponent(expand)}&$select=${encodeURIComponent(select)}`;
  const json = await graphGet<{ value: GraphListItemVersion[] }>(url, accessToken);
  return json?.value ?? [];
}

// Fetch candidates with status=Deployed ordered by lastModified desc, stop when older than "since"
async function fetchDeployedCandidates(
  accessToken: string,
  siteId: string,
  listId: string,
  since: Date,
  pageSize = DEPLOYED_PAGE_SIZE
): Promise<GraphListItemRaw[]> {
  const sinceIso = since.toISOString();
  const filter = `fields/${FIELD_MAP.status} eq 'Deployed' and lastModifiedDateTime ge ${sinceIso}`;
  const select = "id,createdDateTime,lastModifiedDateTime,createdBy,lastModifiedBy";
  const expand = `fields($select=${SP_FIELDS_SELECT})`;
  const sinceMs = since.getTime();

  let results: GraphListItemRaw[] = [];
  let next: string | undefined = undefined;

  const buildUrl = () => {
    const sp = new URLSearchParams();
    sp.set("$top", String(pageSize));
    sp.set("$select", select);
    sp.set("$expand", expand);
    sp.set("$orderby", "lastModifiedDateTime desc");
    sp.set("$filter", filter);
    return `${GRAPH_BASE}/sites/${encodeURIComponent(siteId)}/lists/${encodeURIComponent(
      listId
    )}/items?${sp.toString()}`;
  };

  // first page (or continue with @odata.nextLink)
  const url = buildUrl();
  while (true) {
    const json: GraphListItemsResponse = await graphGet<GraphListItemsResponse>(next ?? url, accessToken);
    const pageItems = json?.value ?? [];
    results = results.concat(pageItems);
    // Stop if last item's lastModified < since
    const last = pageItems[pageItems.length - 1];
    const lastMs = last?.lastModifiedDateTime ? new Date(last.lastModifiedDateTime).getTime() : Infinity;
    if (!json?.["@odata.nextLink"] || Number.isNaN(lastMs) || lastMs < sinceMs) {
      break;
    }
    next = json?.["@odata.nextLink"];
  }

  // Filter out older than since
  return results.filter((li) => {
    const t = li.lastModifiedDateTime ? new Date(li.lastModifiedDateTime).getTime() : 0;
    return !Number.isNaN(t) && t >= sinceMs;
  });
}

function toDate(d?: string): Date | undefined {
  if (!d) return undefined;
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? undefined : dt;
}

function isSameUtcDay(a?: string, b?: string): boolean {
  const da = toDate(a);
  const db = toDate(b);
  if (!da || !db) return false;
  return (
    da.getUTCFullYear() === db.getUTCFullYear() &&
    da.getUTCMonth() === db.getUTCMonth() &&
    da.getUTCDate() === db.getUTCDate()
  );
}

function pickField(obj: Record<string, unknown> | undefined, domain: DomainField) {
  if (!obj) return undefined;
  return obj[FIELD_MAP[domain]];
}

function detectLatestChangedFieldForDay(
  versions: GraphListItemVersion[],
  activityDateTime?: string
): DomainField | undefined {
  if (!activityDateTime || versions.length === 0) return undefined;

  // Filter only versions that occurred on the same UTC day as the activity timestamp.
  const sameDay = versions.filter((v) => isSameUtcDay(v.lastModifiedDateTime, activityDateTime));
  if (sameDay.length < 2) {
    // Requirement: only highlight when multiple column changes occurred within the same day.
    return undefined;
  }

  // Determine how many domain fields differ between the newest and oldest version on that day.
  const newest = sameDay[0];
  const oldest = sameDay[sameDay.length - 1];
  if (!newest?.fields || !oldest?.fields) return undefined;

  const DOMAIN_ORDER: DomainField[] = [
    "asset",
    "userLocation",
    "status",
    "serial",
    "model",
    "assetImage",
    "notes",
  ];

  let changedCount = 0;
  for (const key of DOMAIN_ORDER) {
    const a = pickField(newest.fields, key);
    const b = pickField(oldest.fields, key);
    if (String(a ?? "") !== String(b ?? "")) {
      changedCount++;
    }
  }
  if (changedCount <= 1) {
    // Only one field changed across the day -> do not highlight.
    return undefined;
  }

  // Pick the newest changed field (compare newest with the immediately previous version if available).
  const newestIndex = versions.findIndex((v) => v === sameDay[0]);
  const prev = versions[newestIndex + 1];
  const compareTo = prev?.fields ? prev : sameDay[1]; // fallback to the next same-day version
  if (!compareTo?.fields) return undefined;

  for (const key of DOMAIN_ORDER) {
    const a = pickField(newest.fields, key);
    const b = pickField(compareTo.fields, key);
    if (String(a ?? "") !== String(b ?? "")) {
      return key;
    }
  }
  return undefined;
}

/**
 * Fetch latest items and compute _activityDateTime and _latestChangedField dot.
 */
export async function fetchRecentInventoryActivity(
  accessToken: string,
  limit = 10
): Promise<(InventoryItem & { _activityDateTime?: string; _latestChangedField?: DomainField })[]> {
  const hostname = getEnv("SP_HOSTNAME");
  const sitePath = getEnv("SP_SITE_PATH");
  const listIdOrName = getEnv("SP_LIST_ID_OR_NAME");

  const siteId = await getSiteId(accessToken, hostname, sitePath);
  const listId = await getListId(accessToken, siteId, listIdOrName);

  // Fetch a small buffer to account for items we might skip
  const rawItems = await fetchRecentListItems(accessToken, siteId, listId, Math.max(25, limit));
  // Map to domain and compute activity timestamp from system fields
  type EnrichedItem = InventoryItem & { _activityDateTime?: string; _latestChangedField?: DomainField };
  const enrichedAll = await Promise.all(
    rawItems.slice(0, Math.max(25, limit)).map(async (li): Promise<EnrichedItem | null> => {
      const activity = li.lastModifiedDateTime || li.createdDateTime || "";
      let latestChanged: DomainField | undefined = undefined;
      try {
        const versions = await fetchListItemVersions(accessToken, siteId, listId, li.id, 5);
        latestChanged = detectLatestChangedFieldForDay(versions, activity);
      } catch {
        // ignore versions failures; leave highlight undefined
      }
      try {
        const item = mapGraphListItemToInventory(li.fields ?? {}, li);
        return { ...item, _activityDateTime: activity, _latestChangedField: latestChanged };
      } catch {
        // Skip invalid items (e.g., non-numeric serial)
        return null;
      }
    })
  );
  const enriched = enrichedAll.filter((x): x is EnrichedItem => x !== null);

  // Sort by _activityDateTime desc (full precision), then slice top N
  const sorted = enriched
    .filter((x) => !!x._activityDateTime)
    .sort(
      (a, b) =>
        new Date(b._activityDateTime as string).getTime() -
        new Date(a._activityDateTime as string).getTime()
    )
    .slice(0, limit);

  return sorted;
}

/**
 * Convenience wrapper with user token for recent activity.
 */
export async function fetchRecentInventoryActivityWithUserToken(
  userAccessToken: string,
  limit = 10
): Promise<(InventoryItem & { _activityDateTime?: string; _latestChangedField?: DomainField })[]> {
  const scopes = (process.env.GRAPH_SCOPES || "https://graph.microsoft.com/.default")
    .split(/[,\s]+/)
    .filter(Boolean);
  const graphToken = await acquireOboToken(userAccessToken, scopes);
  return fetchRecentInventoryActivity(graphToken, limit);
}

/**
 * Normalize status strings similarly to validation (local copy).
 */
function normalizeStatusValue(val: unknown): string {
  if (typeof val !== "string") return "";
  return val.trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
}

/**
 * Pure helper to find the timestamp when status became deployed given versions list.
 * Exported for unit testing.
 */
export function findDeployedTransitionTimestamp(
  versions: GraphListItemVersion[]
): string | undefined {
  // Versions are expected newest-first.
  // Only consider a transition when there is a previous version to compare against.
  for (let i = 0; i < versions.length - 1; i++) {
    const cur = versions[i];
    const prev = versions[i + 1];
    const curFields = cur.fields as Record<string, unknown> | undefined;
    const prevFields = prev?.fields as Record<string, unknown> | undefined;
    const curStatus = normalizeStatusValue(curFields?.[FIELD_MAP.status]);
    const prevStatus = normalizeStatusValue(prevFields?.[FIELD_MAP.status]);
    if (curStatus === "deployed" && prevStatus !== "deployed") {
      return cur.lastModifiedDateTime;
    }
  }
  // Fallback: if newest known version is deployed, return its timestamp.
  if (versions[0]) {
    const newestFields = versions[0].fields as Record<string, unknown> | undefined;
    const newestStatus = normalizeStatusValue(newestFields?.[FIELD_MAP.status]);
    if (newestStatus === "deployed") {
      return versions[0].lastModifiedDateTime;
    }
  }
  return undefined;
}

/**
 * Determine when an item's status became "deployed" by inspecting versions.
 * Returns the version's lastModifiedDateTime at which status transitioned to deployed.
 */
async function getStatusDeployedAt(
  accessToken: string,
  siteId: string,
  listId: string,
  itemId: string
): Promise<string | undefined> {
  // Cache hit short-circuit
  const cached = deployedAtCache.get(itemId);
  if (cached) return cached;

  // Fetch a limited number of versions (tuneable) to find the transition quickly.
  const versions = await fetchListItemVersions(accessToken, siteId, listId, itemId, 10);
  const ts = findDeployedTransitionTimestamp(versions);
  if (ts) {
    deployedAtCache.set(itemId, ts);
    return ts;
  }
  return undefined;
}

/**
 * Fetch items whose status transitioned to "deployed" on/after the given date.
 */
export async function fetchDeployedSince(accessToken: string, since: Date): Promise<InventoryItem[]> {
  const hostname = getEnv("SP_HOSTNAME");
  const sitePath = getEnv("SP_SITE_PATH");
  const listIdOrName = getEnv("SP_LIST_ID_OR_NAME");

  // Cache key rounded to day to avoid excessive keys for identical ranges (week/month)
  const deployedCacheKey = `${hostname}|${sitePath}|${listIdOrName}|${since.toISOString().slice(0, 10)}`;
  if (deployedTtlMs > 0) {
    const cached = deployedSinceCache.get(deployedCacheKey);
    if (cached) return cached;
  }

  const siteId = await getSiteId(accessToken, hostname, sitePath);
  const listId = await getListId(accessToken, siteId, listIdOrName);

  const candidates = await fetchDeployedCandidates(accessToken, siteId, listId, since);

  const sinceMs = since.getTime();
  const out: InventoryItem[] = [];

  // Limit concurrency of version lookups to keep the endpoint responsive.
  const BATCH = DEPLOYED_CONCURRENCY;
  for (let i = 0; i < candidates.length; i += BATCH) {
    const slice = candidates.slice(i, i + BATCH);
    const processed = await Promise.all(
      slice.map(async (li) => {
        try {
          const deployedAt = await getStatusDeployedAt(accessToken, siteId, listId, li.id);
          if (!deployedAt) return null;
          const deployedMs = new Date(deployedAt).getTime();
          if (Number.isNaN(deployedMs) || deployedMs < sinceMs) return null;

          try {
            const item = mapGraphListItemToInventory(li.fields ?? {}, li);
            return item;
          } catch {
            return null;
          }
        } catch {
          return null;
        }
      })
    );
    for (const item of processed) {
      if (item) out.push(item);
    }
    if (DEPLOYED_MAX_RESULTS > 0 && out.length >= DEPLOYED_MAX_RESULTS) {
      break;
    }
  }

  // Sort for stable UI: Modified desc (fallback to Created)
  out.sort((a, b) => {
    const ad = new Date(a.modified || a.created).getTime();
    const bd = new Date(b.modified || b.created).getTime();
    return bd - ad;
  });

  const finalOut = DEPLOYED_MAX_RESULTS > 0 ? out.slice(0, DEPLOYED_MAX_RESULTS) : out;

  if (deployedTtlMs > 0) {
    deployedSinceCache.set(deployedCacheKey, finalOut);
  }
  return finalOut;
}

/**
 * OBO wrapper for deployed-since query.
 */
export async function fetchDeployedSinceWithUserToken(
  userAccessToken: string,
  since: Date
): Promise<InventoryItem[]> {
  const scopes = (process.env.GRAPH_SCOPES || "https://graph.microsoft.com/.default")
    .split(/[,\s]+/)
    .filter(Boolean);
  const graphToken = await acquireOboToken(userAccessToken, scopes);
  return fetchDeployedSince(graphToken, since);
}

/**
 * Internal: generic Graph write (PATCH/POST/DELETE) with limited retry on 429/503.
 * Metrics are not emitted here (kept simple); DEBUG_GRAPH prints minimal diagnostics.
 */
export class GraphHttpError extends Error {
  status: number;
  body?: string;
  constructor(status: number, body?: string) {
    super(`Graph HTTP ${status}${body ? `: ${body}` : ""}`);
    this.name = "GraphHttpError";
    this.status = status;
    this.body = body;
  }
}

type GraphWriteMethod = "PATCH" | "POST" | "DELETE";

async function graphSend(
  method: GraphWriteMethod,
  url: string,
  accessToken: string,
  body?: unknown,
  extraHeaders?: HeadersInit
): Promise<Response> {
  const started = Date.now();
  let attempt = 0;
  let retryCount = 0;
  let lastErr: unknown;
  let lastStatus = 0;

  while (attempt <= MAX_RETRIES) {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(extraHeaders || {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    lastStatus = res.status;

    if (res.ok) {
      if (process.env.DEBUG_GRAPH === "true") {
        // eslint-disable-next-line no-console
        console.debug("Graph write ok", { method, status: res.status, attempts: attempt + 1, retryCount, ms: Date.now() - started, url });
      }
      return res;
    }

    if (res.status === 429 || res.status === 503) {
      if (attempt === MAX_RETRIES) {
        lastErr = new Error(`Graph ${res.status}: exceeded retries`);
        break;
      }
      retryCount++;
      const ra = res.headers.get("Retry-After");
      const delay = ra ? parseRetryAfter(ra) : backoffDelay(attempt);
      await sleep(delay);
      attempt++;
      continue;
    }

    const text = await res.text();
    if (process.env.DEBUG_GRAPH === "true") {
      // eslint-disable-next-line no-console
      console.debug("Graph write error", { method, status: res.status, attempts: attempt + 1, retryCount, ms: Date.now() - started, url, text });
    }
    throw new GraphHttpError(res.status, text);
  }

  if (lastErr) throw lastErr;
  throw new GraphHttpError(lastStatus || 0);
}

/**
 * PATCH fields for a list item.
 * - fields: object of SharePoint INTERNAL field names to new values (not domain keys)
 * - ifMatch: specific ETag or "*" to force
 * Returns latest eTag when determinable (header or follow-up GET), otherwise undefined.
 */
export async function updateListItemFields(
  accessToken: string,
  siteId: string,
  listId: string,
  itemId: string,
  fields: Record<string, unknown>,
  ifMatch: string = "*"
): Promise<{ eTag?: string }> {
  const url = `${GRAPH_BASE}/sites/${encodeURIComponent(siteId)}/lists/${encodeURIComponent(
    listId
  )}/items/${encodeURIComponent(itemId)}/fields`;

  const res = await graphSend("PATCH", url, accessToken, fields, { "If-Match": ifMatch });
  // Prefer ETag response header when present
  const hdr = res.headers.get("ETag") || res.headers.get("Etag") || res.headers.get("etag");
  if (hdr) return { eTag: hdr };

  // Fallback: fetch item to read ETag
  try {
    const { eTag } = await getListItemETag(accessToken, siteId, listId, itemId);
    return { eTag };
  } catch {
    return { eTag: undefined };
  }
}

/**
 * DELETE a list item by id with If-Match support (defaults to "*").
 */
export async function deleteListItem(
  accessToken: string,
  siteId: string,
  listId: string,
  itemId: string,
  ifMatch: string = "*"
): Promise<void> {
  const url = `${GRAPH_BASE}/sites/${encodeURIComponent(siteId)}/lists/${encodeURIComponent(
    listId
  )}/items/${encodeURIComponent(itemId)}`;
  const res = await graphSend("DELETE", url, accessToken, undefined, { "If-Match": ifMatch });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Graph delete failed ${res.status}: ${t || "unknown"}`);
  }
}

/**
 * Fetch a list item's current ETag from headers or body.
 */
export async function getListItemETag(
  accessToken: string,
  siteId: string,
  listId: string,
  itemId: string
): Promise<{ eTag: string | undefined }> {
  const url = `${GRAPH_BASE}/sites/${encodeURIComponent(siteId)}/lists/${encodeURIComponent(
    listId
  )}/items/${encodeURIComponent(itemId)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Graph getListItemETag failed ${res.status}: ${t || "unknown"}`);
  }
  const hdr = res.headers.get("ETag") || res.headers.get("Etag") || res.headers.get("etag");
  if (hdr) return { eTag: hdr };
  try {
    type ETagBody = { eTag?: string } & { "@odata.etag"?: string };
    const js = (await res.json()) as ETagBody;
    return { eTag: js.eTag || js["@odata.etag"] };
  } catch {
    return { eTag: undefined };
  }
}

/**
 * High-level helpers that operate with a user API token (OBO for Graph).
 * These locate the itemId for a given asset number and perform the write.
 */
export async function updateInventoryItemFieldsWithUserToken(
  userAccessToken: string,
  assetNumber: number,
  spFieldPatch: Record<string, unknown>,
  etag?: string
): Promise<{ eTag?: string }> {
  // Resolve ids using existing helper (internally performs OBO)
  const ids = await findListItemIdByAssetWithUserToken(userAccessToken, assetNumber);
  if (!ids) {
    throw new Error("Asset not found");
  }

  const scopes = (process.env.GRAPH_SCOPES || "https://graph.microsoft.com/.default")
    .split(/[,\s]+/)
    .filter(Boolean);
  const graphToken = await acquireOboToken(userAccessToken, scopes);

  return updateListItemFields(graphToken, ids.siteId, ids.listId, ids.itemId, spFieldPatch, etag || "*");
}

export async function deleteInventoryItemWithUserToken(
  userAccessToken: string,
  assetNumber: number,
  etag?: string
): Promise<void> {
  const ids = await findListItemIdByAssetWithUserToken(userAccessToken, assetNumber);
  if (!ids) {
    throw new Error("Asset not found");
  }
  const scopes = (process.env.GRAPH_SCOPES || "https://graph.microsoft.com/.default")
    .split(/[,\s]+/)
    .filter(Boolean);
  const graphToken = await acquireOboToken(userAccessToken, scopes);
  await deleteListItem(graphToken, ids.siteId, ids.listId, ids.itemId, etag || "*");
}

/**
 * Create a list item with given SharePoint INTERNAL fields. Returns new item id and eTag if present.
 */
export async function createListItem(
  accessToken: string,
  siteId: string,
  listId: string,
  fields: Record<string, unknown>
): Promise<{ id?: string; eTag?: string }> {
  const url = `${GRAPH_BASE}/sites/${encodeURIComponent(siteId)}/lists/${encodeURIComponent(
    listId
  )}/items`;
  const res = await graphSend("POST", url, accessToken, { fields });
  const hdr = res.headers.get("ETag") || res.headers.get("Etag") || res.headers.get("etag") || undefined;
  let id: string | undefined;
  try {
    const js = (await res.json()) as { id?: string };
    id = js?.id;
  } catch {
    // ignore
  }
  return { id, eTag: hdr || undefined };
}

/**
 * Create a list item using the user's API token (OBO to Graph).
 * Resolves site/list from env and returns id/eTag.
 */
export async function createInventoryItemWithUserToken(
  userAccessToken: string,
  spFields: Record<string, unknown>
): Promise<{ id?: string; eTag?: string }> {
  const scopes = (process.env.GRAPH_SCOPES || "https://graph.microsoft.com/.default")
    .split(/[,\s]+/)
    .filter(Boolean);
  const accessToken = await acquireOboToken(userAccessToken, scopes);

  const hostname = getEnv("SP_HOSTNAME");
  const sitePath = getEnv("SP_SITE_PATH");
  const listIdOrName = getEnv("SP_LIST_ID_OR_NAME");

  const siteId = await getSiteId(accessToken, hostname, sitePath);
  const listId = await getListId(accessToken, siteId, listIdOrName);
  return createListItem(accessToken, siteId, listId, spFields);
}

/**
 * TTL (ms) for distinct models cache (defaults to 15 minutes).
 */
const MODELS_CACHE_TTL_MS = Number.parseInt(process.env.MODELS_CACHE_TTL_SECONDS || "900", 10) * 1000;

/**
 * In-memory cache for distinct model values per site/list.
 * Keyed by `${hostname}|${sitePath}|${listIdOrName}|models`
 */
const modelsCache = new LRUCache<string, string[]>({ max: 100, ttl: MODELS_CACHE_TTL_MS });

/**
 * Return distinct Model values by scanning list items (Model is a free-text field).
 * Caller supplies a user API token; we perform OBO to Graph.
 */
export async function listDistinctModelsViaScanWithUserToken(userAccessToken: string): Promise<string[]> {
  const scopes = (process.env.GRAPH_SCOPES || "https://graph.microsoft.com/.default")
    .split(/[,\s]+/)
    .filter(Boolean);
  const accessToken = await acquireOboToken(userAccessToken, scopes);

  const hostname = getEnv("SP_HOSTNAME");
  const sitePath = getEnv("SP_SITE_PATH");
  const listIdOrName = getEnv("SP_LIST_ID_OR_NAME");

  const cacheKey = `${hostname}|${sitePath}|${listIdOrName}|models`;
  const cached = modelsCache.get(cacheKey);
  if (cached) return cached.slice();

  const siteId = await getSiteId(accessToken, hostname, sitePath);
  const listId = await getListId(accessToken, siteId, listIdOrName);
  const all = await fetchAllListItems(accessToken, siteId, listId);

  const set = new Set<string>();
  for (const li of all) {
    const f = (li.fields || {}) as Record<string, unknown>;
    const raw = f[FIELD_MAP.model];
    if (typeof raw === "string") {
      const val = raw.trim();
      if (val) set.add(val);
    }
  }
  const models = Array.from(set).sort((a, b) => a.localeCompare(b));
  modelsCache.set(cacheKey, models);
  return models;
}

/**
 * Invalidate cached distinct model values (e.g., after item PATCH that changes Model).
 */
export function invalidateModelsCache(): void {
  modelsCache.clear();
}

/**
 * TTL (ms) for distinct user suggestions cache (defaults to 15 minutes).
 */
const USERS_CACHE_TTL_MS = Number.parseInt(process.env.USERS_CACHE_TTL_SECONDS || "900", 10) * 1000;

/**
 * In-memory cache for distinct user display names per site/list.
 * Keyed by `${hostname}|${sitePath}|${listIdOrName}|users`
 */
const usersCache = new LRUCache<string, string[]>({ max: 100, ttl: USERS_CACHE_TTL_MS });

/**
 * Return distinct user-like display names by scanning list items:
 * - createdBy / lastModifiedBy display names
 * - the prefix segment of the "User/Location" field (before "/", en dash, or hyphen)
 * Caller supplies a user API token; we perform OBO to Graph.
 */
export async function listDistinctUsersViaScanWithUserToken(userAccessToken: string): Promise<string[]> {
  const scopes = (process.env.GRAPH_SCOPES || "https://graph.microsoft.com/.default")
    .split(/[,\s]+/)
    .filter(Boolean);
  const accessToken = await acquireOboToken(userAccessToken, scopes);

  const hostname = getEnv("SP_HOSTNAME");
  const sitePath = getEnv("SP_SITE_PATH");
  const listIdOrName = getEnv("SP_LIST_ID_OR_NAME");

  const cacheKey = `${hostname}|${sitePath}|${listIdOrName}|users`;
  const cached = usersCache.get(cacheKey);
  if (cached) return cached.slice();

  const siteId = await getSiteId(accessToken, hostname, sitePath);
  const listId = await getListId(accessToken, siteId, listIdOrName);
  const all = await fetchAllListItems(accessToken, siteId, listId);

  const set = new Set<string>();
  for (const li of all) {
    const createdBy = li.createdBy?.user?.displayName;
    const modifiedBy = li.lastModifiedBy?.user?.displayName;
    if (typeof createdBy === "string" && createdBy.trim()) set.add(createdBy.trim());
    if (typeof modifiedBy === "string" && modifiedBy.trim()) set.add(modifiedBy.trim());

    const f = (li.fields || {}) as Record<string, unknown>;
    const raw = f[FIELD_MAP.userLocation];
    if (typeof raw === "string" && raw.trim()) {
      const parts = raw.split(/[\/–-]/); // split on "/", en dash, hyphen
      const candidate = (parts[0] || "").trim();
      if (candidate && candidate.length > 1) set.add(candidate);
    }
  }

  const users = Array.from(set).sort((a, b) => a.localeCompare(b));
  usersCache.set(cacheKey, users);
  return users;
}

/**
 * Invalidate cached distinct users (e.g., after edits that change authors or user/location values).
 */
export function invalidateUsersCache(): void {
  usersCache.clear();
}

export type DirectoryUser = {
  id: string;
  displayName?: string | null;
  mail?: string | null;
  userPrincipalName?: string | null;
};

/**
 * Search Azure AD users via Graph /users?$search="..."
 * Requires delegated scope allowing directory read (e.g., User.ReadBasic.All) and header ConsistencyLevel: eventual.
 */
export async function searchUsersWithUserToken(
  userAccessToken: string,
  query: string,
  top = 20
): Promise<DirectoryUser[]> {
  const scopes = (process.env.GRAPH_SCOPES || "https://graph.microsoft.com/.default")
    .split(/[,\s]+/)
    .filter(Boolean);
  const accessToken = await acquireOboToken(userAccessToken, scopes);

  const q = (query || "").trim().replace(/"/g, "");
  const sp = new URLSearchParams();
  // $search searches across multiple indexed fields; requires ConsistencyLevel: eventual header
  sp.set("$search", `"${q}"`);
  sp.set("$select", "id,displayName,mail,userPrincipalName");
  sp.set("$top", String(Math.max(1, Math.min(top || 20, 50))));

  const url = `${GRAPH_BASE}/users?${sp.toString()}`;

  type UsersResp = {
    value: Array<{ id: string; displayName?: string | null; mail?: string | null; userPrincipalName?: string | null }>;
  };

  const json = await graphGet<UsersResp>(url, accessToken, { ConsistencyLevel: "eventual" });
  const arr = json?.value ?? [];
  return arr.map((u) => ({
    id: u.id,
    displayName: u.displayName ?? null,
    mail: u.mail ?? null,
    userPrincipalName: u.userPrincipalName ?? null,
  }));
}

/**
 * Compute the next Asset number by inspecting SharePoint field_1 (numeric), falling back to Title if needed.
 * Returns 1 when the list is empty or values are not numeric.
 */
export async function getNextAssetNumber(accessToken: string): Promise<number> {
  const hostname = getEnv("SP_HOSTNAME");
  const sitePath = getEnv("SP_SITE_PATH");
  const listIdOrName = getEnv("SP_LIST_ID_OR_NAME");

  const siteId = await getSiteId(accessToken, hostname, sitePath);
  const listId = await getListId(accessToken, siteId, listIdOrName);

  // Try efficient top-1 by field_1 desc
  const sp1 = new URLSearchParams();
  sp1.set("$top", "1");
  sp1.set("$select", "id");
  sp1.set("$expand", "fields($select=field_1,Title)");
  sp1.set("$orderby", "fields/field_1 desc");

  type TopResp = { value: Array<{ id: string; fields?: Record<string, unknown> }> };
  try {
    const url1 = `${GRAPH_BASE}/sites/${encodeURIComponent(siteId)}/lists/${encodeURIComponent(
      listId
    )}/items?${sp1.toString()}`;
    const js1 = await graphGet<TopResp>(url1, accessToken, {
      Prefer: "HonorNonIndexedQueriesWarningMayFailRandomly",
    });
    const f1 = (js1?.value?.[0]?.fields || {}) as Record<string, unknown>;
    const candidates = [f1["field_1"], f1["Title"]].map((v) => (typeof v === "string" || typeof v === "number" ? Number(v) : NaN));
    const best = candidates.find((n) => Number.isFinite(n)) as number | undefined;
    if (typeof best === "number" && Number.isFinite(best)) {
      return (best as number) + 1;
    }
  } catch {
    // fall through to scan
  }

  // Fallback: scan first page (up to 200) and compute numeric max across field_1 and Title
  const sp2 = new URLSearchParams();
  sp2.set("$top", "200");
  sp2.set("$select", "id");
  sp2.set("$expand", "fields($select=field_1,Title)");

  try {
    const url2 = `${GRAPH_BASE}/sites/${encodeURIComponent(siteId)}/lists/${encodeURIComponent(
      listId
    )}/items?${sp2.toString()}`;
    const js2 = await graphGet<TopResp>(url2, accessToken, {
      Prefer: "HonorNonIndexedQueriesWarningMayFailRandomly",
    });
    const values: number[] = [];
    for (const it of js2?.value ?? []) {
      const f = (it.fields || {}) as Record<string, unknown>;
      const nums = [f["field_1"], f["Title"]].map((v) =>
        typeof v === "string" || typeof v === "number" ? Number(v) : NaN
      );
      for (const n of nums) if (Number.isFinite(n)) values.push(n as number);
    }
    const max = values.length ? Math.max(...values) : NaN;
    return Number.isFinite(max) ? max + 1 : 1;
  } catch {
    return 1;
  }
}

/**
 * OBO wrapper to compute next asset using the current user's API token.
 */
export async function getNextAssetWithUserToken(userAccessToken: string): Promise<number> {
  const scopes = (process.env.GRAPH_SCOPES || "https://graph.microsoft.com/.default")
    .split(/[,\s]+/)
    .filter(Boolean);
  const accessToken = await acquireOboToken(userAccessToken, scopes);
  return getNextAssetNumber(accessToken);
}
