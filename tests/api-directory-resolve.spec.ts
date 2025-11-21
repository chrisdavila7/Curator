// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import type { NextRequest } from "next/server";

// Route under test
import { GET as GET_RESOLVE } from "@/app/api/directory/resolve/route";

// We'll mock the Graph-backed helpers used by the route
vi.mock("@/lib/graph/users", () => {
  return {
    findUserWithUserToken: vi.fn(),
    getManagerWithUserToken: vi.fn(),
  };
});

function makeReq(
  url: string,
  authHeader?: string
): { nextUrl: { searchParams: URLSearchParams; pathname: string }; headers: Headers } {
  const u = new URL(url, "http://localhost");
  const headers = new Headers();
  if (authHeader) headers.set("Authorization", authHeader);
  return { nextUrl: { searchParams: u.searchParams, pathname: u.pathname }, headers };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("API /api/directory/resolve", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const res = await GET_RESOLVE(makeReq("/api/directory/resolve?query=Jane") as unknown as NextRequest);
    expect(res.status).toBe(401);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns 400 when query param is missing or empty", async () => {
    const res = await GET_RESOLVE(
      makeReq("/api/directory/resolve", "Bearer user-token") as unknown as NextRequest
    );
    expect(res.status).toBe(400);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns user and manager on success with no-store header", async () => {
    const { findUserWithUserToken, getManagerWithUserToken } = await import("@/lib/graph/users");
    const findUser = vi.mocked(findUserWithUserToken);
    const getManager = vi.mocked(getManagerWithUserToken);

    findUser.mockResolvedValue({
      id: "user-1",
      displayName: "Jane Doe",
      userPrincipalName: "jane.doe@contoso.com",
      companyName: "Contoso Ltd",
      department: "Engineering",
    });

    getManager.mockResolvedValue({
      id: "mgr-1",
      displayName: "Ada Lovelace",
      userPrincipalName: "ada@contoso.com",
    });

    const res = await GET_RESOLVE(
      makeReq("/api/directory/resolve?query=Jane%20Doe", "Bearer user-token") as unknown as NextRequest
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");

    const body = (await res.json()) as {
      user: { id: string; displayName: string; userPrincipalName: string; companyName?: string; department?: string } | null;
      manager: { id: string; displayName: string; userPrincipalName: string } | null;
    };

    expect(body.user).not.toBeNull();
    expect(body.user?.displayName).toBe("Jane Doe");
    expect(body.user?.companyName).toBe("Contoso Ltd");
    expect(body.manager?.displayName).toBe("Ada Lovelace");
  });

  it("returns nulls when user not found", async () => {
    const { findUserWithUserToken } = await import("@/lib/graph/users");
    const findUser = vi.mocked(findUserWithUserToken);

    findUser.mockResolvedValue(null);

    const res = await GET_RESOLVE(
      makeReq("/api/directory/resolve?query=Unknown", "Bearer user-token") as unknown as NextRequest
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");

    const body = (await res.json()) as { user: unknown; manager: unknown };
    expect(body.user).toBeNull();
    expect(body.manager).toBeNull();
  });

  it("returns 502 on helper/Graph error", async () => {
    const { findUserWithUserToken } = await import("@/lib/graph/users");
    const findUser = vi.mocked(findUserWithUserToken);

    findUser.mockRejectedValue(new Error("Graph exploded"));

    const res = await GET_RESOLVE(
      makeReq("/api/directory/resolve?query=Jane", "Bearer user-token") as unknown as NextRequest
    );

    expect(res.status).toBe(502);
    expect(res.headers.get("Cache-Control")).toBe("no-store");

    const body = (await res.json()) as { error?: string };
    expect(typeof body.error).toBe("string");
  });
});
