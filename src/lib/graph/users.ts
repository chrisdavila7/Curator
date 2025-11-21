import { acquireOboToken } from "@/lib/auth/msal-server";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

function getGraphScopes(): string[] {
  return (process.env.GRAPH_SCOPES || "https://graph.microsoft.com/.default")
    .split(/[,\s]+/)
    .filter(Boolean);
}

async function getGraphTokenForUser(userAccessToken: string): Promise<string> {
  const scopes = getGraphScopes();
  return acquireOboToken(userAccessToken, scopes);
}

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
    const txt = await res.text().catch(() => "");
    const err: Error & { status?: number; body?: string } = new Error(`Graph GET ${res.status}: ${txt || "unknown"}`);
    err.status = res.status;
    err.body = txt;
    throw err;
  }
  return (await res.json()) as T;
}

type GraphUser = {
  id: string;
  displayName: string;
  userPrincipalName: string;
  mail?: string;
  companyName?: string;
  department?: string;
};

type GraphUsersList = {
  value: GraphUser[];
};

// Build up to three alias candidates from a "First Last" style input:
// jdoe, hdoe, oDoe → first 1..3 letters of first name + last name, lowercased.
// If parsing fails (no space), returns [].
export const getAliasCandidates = (q: string): string[] => {
  const s = q.trim().replace(/\s+/g, " ");
  const parts = s.split(" ");
  if (parts.length < 2) return [];
  const first = parts[0] || "";
  const last = parts[parts.length - 1] || "";
  if (!first || !last) return [];
  const out: string[] = [];
  // Progressive prefix attempts: 1..3 letters of first name + last name
  for (let i = 0; i < Math.min(3, first.length); i++) {
    const prefix = first.slice(0, i + 1);
    const alias = `${prefix}${last}`.toLowerCase().replace(/[^a-z0-9._-]/gi, "");
    if (alias.length > 0) out.push(alias);
  }
  // De-duplicate
  return Array.from(new Set(out));
};

const tryFindByAlias = async (
  accessToken: string,
  alias: string,
  select: string,
  log: (...args: unknown[]) => void
): Promise<GraphUser | null> => {
  // Use $filter with startswith on userPrincipalName and mail, and exact on mailNickname
  const esc = alias.replace(/'/g, "''");
  const filter = `startswith(userPrincipalName,'${esc}') or startswith(mail,'${esc}') or mailNickname eq '${esc}'`;
  const url = `${GRAPH_BASE}/users?${select}&$filter=${encodeURIComponent(filter)}&$top=1`;
  log("alias-filter", { url, alias });
  try {
    const res = await graphGetJson<GraphUsersList>(url, accessToken);
    const u = (res.value || [])[0];
    return u || null;
  } catch (e) {
    // Treat errors as no match for this alias, and continue
    return null;
  }
};

/**
 * Try to resolve a user by a free-text query.
 * - If the query looks like an email/UPN (contains '@' and no spaces), try direct /users/{idOrUpn}
 * - Else use a fuzzy filter: startswith(displayName,'q') or startswith(userPrincipalName,'q')
 * Choose a best match deterministically:
 *   1) exact UPN match (case-insensitive)
 *   2) exact displayName match (case-insensitive, trimmed)
 *   3) startsWith(displayName)
 *   4) first result
 */
export async function findUserWithUserToken(
  userAccessToken: string,
  query: string
): Promise<{ id: string; displayName: string; userPrincipalName: string; companyName?: string; department?: string } | null> {
  const accessToken = await getGraphTokenForUser(userAccessToken);
  const q = String(query || "").trim();
  if (!q) return null;

  const select = "$select=id,displayName,userPrincipalName,mail,companyName,department";

  const debug = process.env.DEBUG_GRAPH === "true";
  const log = (...args: unknown[]) => {
    if (debug) console.info("[GRAPH] users.find", ...args);
  };

  const looksLikeUpn = q.includes("@") && !/\s/.test(q);

  // 1) Direct lookup by id/UPN
  if (looksLikeUpn) {
    const url = `${GRAPH_BASE}/users/${encodeURIComponent(q)}?${select}`;
    try {
      log("direct", { url });
      const u = await graphGetJson<GraphUser>(url, accessToken);
      return {
        id: u.id,
        displayName: u.displayName,
        userPrincipalName: u.userPrincipalName,
        companyName: u.companyName,
        department: u.department,
      };
    } catch (e) {
      const ee = e as { status?: number };
      if (ee.status !== 404) {
        // Only swallow 404 for fallback; rethrow other errors
        throw e;
      }
      log("direct 404, falling back");
    }
  }

  // 2) Heuristic alias attempts from "First Last": first 1..3 letters of first + last (lowercased)
  const aliases = getAliasCandidates(q);
  for (const alias of aliases) {
    const u = await tryFindByAlias(accessToken, alias, select, log);
    if (u) {
      return {
        id: u.id,
        displayName: u.displayName,
        userPrincipalName: u.userPrincipalName,
        companyName: u.companyName,
        department: u.department,
      };
    }
  }

  // No alias matches; per updated requirements leave blank after third attempt
  return null;
}

export async function getManagerWithUserToken(
  userAccessToken: string,
  userId: string
): Promise<{ id: string; displayName: string; userPrincipalName: string } | null> {
  const accessToken = await getGraphTokenForUser(userAccessToken);
  const debug = process.env.DEBUG_GRAPH === "true";
  const log = (...args: unknown[]) => {
    if (debug) console.info("[GRAPH] users.manager", ...args);
  };

  const url = `${GRAPH_BASE}/users/${encodeURIComponent(userId)}/manager?$select=id,displayName,userPrincipalName`;
  try {
    log("manager", { url, userId });
    const m = await graphGetJson<{ id: string; displayName: string; userPrincipalName: string }>(url, accessToken);
    if (!m?.id) return null;
    return { id: m.id, displayName: m.displayName, userPrincipalName: m.userPrincipalName };
  } catch (e) {
    const ee = e as { status?: number };
    if (ee.status === 404) {
      // No manager
      return null;
    }
    throw e;
  }
}
