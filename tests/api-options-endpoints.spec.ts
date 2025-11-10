// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";
import type { NextRequest } from "next/server";
import { GET as GET_MODELS } from "@/app/api/inventory/options/models/route";
import { GET as GET_USERS } from "@/app/api/inventory/options/users/route";
import { GET as GET_LOCATIONS } from "@/app/api/inventory/options/locations/route";

/**
 * Minimal NextRequest-like stub for our route handlers.
 */
function makeReq(url: string): { nextUrl: { searchParams: URLSearchParams }; headers: Headers } {
  const u = new URL(url, "http://localhost");
  const searchParams = u.searchParams;
  const headers = new Headers(); // no auth required in mock mode
  return { nextUrl: { searchParams }, headers };
}

beforeAll(() => {
  // Force mock mode so routes bypass auth and use mock data
  process.env.USE_MOCK_INVENTORY = "true";
});

describe("API /api/inventory/options/models (mock mode)", () => {
  it("returns distinct, sorted models with no-store header", async () => {
    const res = await GET_MODELS(makeReq("/api/inventory/options/models") as unknown as NextRequest);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = (await res.json()) as { models: string[] };
    expect(Array.isArray(body.models)).toBe(true);
    // From mock dataset: 12 unique models
    expect(body.models.length).toBe(12);
    // Sorted check: each <= next
    for (let i = 1; i < body.models.length; i++) {
      expect(body.models[i - 1].localeCompare(body.models[i]) <= 0).toBe(true);
    }
  });

  it("applies top limit", async () => {
    const res = await GET_MODELS(makeReq("/api/inventory/options/models?top=3") as unknown as NextRequest);
    const body = (await res.json()) as { models: string[] };
    expect(body.models.length).toBe(3);
  });

  it("filters by search substring (case-insensitive)", async () => {
    const res = await GET_MODELS(makeReq("/api/inventory/options/models?search=Dell") as unknown as NextRequest);
    const body = (await res.json()) as { models: string[] };
    // Expect only Dell-related models
    expect(body.models.length).toBeGreaterThanOrEqual(1);
    for (const m of body.models) {
      expect(m.toLowerCase()).toContain("dell");
    }
  });
});

describe("API /api/inventory/options/users (mock mode)", () => {
  it("rejects short search queries with 400", async () => {
    const res = await GET_USERS(makeReq("/api/inventory/options/users?search=a") as unknown as NextRequest);
    expect(res.status).toBe(400);
  });

  it("returns users matching search with no-store header", async () => {
    const res = await GET_USERS(makeReq("/api/inventory/options/users?search=Alex") as unknown as NextRequest);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = (await res.json()) as { users: Array<{ id: string; displayName?: string | null }> };
    expect(Array.isArray(body.users)).toBe(true);
    // At least one match for "Alex Rivera" from mock data
    expect(body.users.some((u) => (u.displayName || "").includes("Alex Rivera"))).toBe(true);
  });

  it("applies top limit", async () => {
    const res = await GET_USERS(makeReq("/api/inventory/options/users?search=ro&top=1") as unknown as NextRequest);
    const body = (await res.json()) as { users: Array<{ id: string }> };
    expect(body.users.length).toBe(1);
  });
});

describe("API /api/inventory/options/locations", () => {
  it("returns static locations in provided order with no-store header", async () => {
    const res = await GET_LOCATIONS(makeReq("/api/inventory/options/locations") as unknown as NextRequest);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = (await res.json()) as { locations: string[] };
    expect(body.locations.length).toBe(15);
    expect(body.locations[0]).toBe("Agency");
    expect(body.locations[body.locations.length - 1]).toBe("Temple");
  });

  it("filters by search", async () => {
    const res = await GET_LOCATIONS(makeReq("/api/inventory/options/locations?search=hou") as unknown as NextRequest);
    const body = (await res.json()) as { locations: string[] };
    expect(body.locations).toContain("Houston");
    // ensure all results contain "hou"
    for (const loc of body.locations) {
      expect(loc.toLowerCase()).toContain("hou");
    }
  });

  it("applies top limit", async () => {
    const res = await GET_LOCATIONS(makeReq("/api/inventory/options/locations?top=5") as unknown as NextRequest);
    const body = (await res.json()) as { locations: string[] };
    expect(body.locations.length).toBe(5);
  });
});
