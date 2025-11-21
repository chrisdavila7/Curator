// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";
import type { NextRequest } from "next/server";

// These routes will be implemented to satisfy the tests (TDD)
import { GET as GET_TEMPLATES } from "@/app/api/templates/route";
import { GET as GET_TEMPLATE_BY_KEY } from "@/app/api/templates/[key]/route";

function makeReq(url: string): { nextUrl: { searchParams: URLSearchParams; pathname: string }; headers: Headers } {
  const u = new URL(url, "http://localhost");
  const searchParams = u.searchParams;
  const headers = new Headers(); // no auth for mock mode
  return { nextUrl: { searchParams, pathname: u.pathname }, headers };
}

beforeAll(() => {
  // Force mock mode for template endpoints
  process.env.USE_MOCK_TEMPLATES = "true";
});

describe("API /api/templates (mock mode)", () => {
  it("returns template list with no-store cache header", async () => {
    const res = await GET_TEMPLATES(makeReq("/api/templates") as unknown as NextRequest);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = (await res.json()) as { templates: Array<{ key: string; name: string }> };
    expect(Array.isArray(body.templates)).toBe(true);
    expect(body.templates.length).toBeGreaterThanOrEqual(1);
    for (const t of body.templates) {
      expect(typeof t.key).toBe("string");
      expect(typeof t.name).toBe("string");
      expect(t.key.length).toBeGreaterThan(0);
      expect(t.name.length).toBeGreaterThan(0);
    }
  });
});

describe("API /api/templates/[key] (mock mode)", () => {
  it("returns a PDF with correct content-type and no-store cache header", async () => {
    // Use the first known mock key
    const key = "asset-checkout-v1";
    const res = await GET_TEMPLATE_BY_KEY(makeReq(`/api/templates/${key}`) as unknown as NextRequest, {
      params: { key },
    } as unknown as { params: { key: string } });
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("Content-Type")).toContain("application/pdf");

    const ab = await res.arrayBuffer();
    const bytes = new Uint8Array(ab);
    const head = Buffer.from(bytes.slice(0, 4)).toString("ascii");
    expect(head).toBe("%PDF");
  });

  it("returns 404 for unknown key", async () => {
    const key = "non-existent-template";
    const res = await GET_TEMPLATE_BY_KEY(makeReq(`/api/templates/${key}`) as unknown as NextRequest, {
      params: { key },
    } as unknown as { params: { key: string } });
    expect(res.status).toBe(404);
  });
});
