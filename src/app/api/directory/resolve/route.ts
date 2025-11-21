import { NextRequest, NextResponse } from "next/server";
import { findUserWithUserToken, getManagerWithUserToken } from "@/lib/graph/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export async function GET(req: NextRequest) {
  const noStoreHeaders = { "Cache-Control": "no-store" };

  // Authorization: Bearer <user-access-token>
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  const token = auth && auth.startsWith("Bearer ") ? auth.slice(7) : undefined;

  if (!token) {
    return json({ error: "Missing Authorization" }, { status: 401, headers: noStoreHeaders });
  }

  const raw = req.nextUrl?.searchParams?.get("query") || "";
  const query = raw.trim();
  if (!query) {
    return json({ error: "Missing query" }, { status: 400, headers: noStoreHeaders });
  }

  try {
    const user = await findUserWithUserToken(token, query);
    let manager: { id: string; displayName: string; userPrincipalName: string } | null = null;

    if (user?.id) {
      manager = await getManagerWithUserToken(token, user.id);
    }

    return json({ user, manager }, { status: 200, headers: noStoreHeaders });
  } catch {
    return json({ error: "Directory lookup failed" }, { status: 502, headers: noStoreHeaders });
  }
}
