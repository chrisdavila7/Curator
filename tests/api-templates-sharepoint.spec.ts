// @vitest-environment node
import { describe, it, expect, beforeAll, vi, afterEach } from "vitest";
import type { NextRequest } from "next/server";

// Routes under test
import { GET as GET_TEMPLATES } from "@/app/api/templates/route";
import { GET as GET_TEMPLATE_BY_KEY } from "@/app/api/templates/[key]/route";

// We'll mock the SharePoint-backed helpers these routes will call in non-mock mode.
// The implementation will live in src/lib/graph/templates.ts
vi.mock("@/lib/graph/templates", () => {
  return {
    listTemplatesWithUserToken: vi.fn(),
    getTemplateBytesWithUserToken: vi.fn(),
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

beforeAll(() => {
  // Force real (non-mock) mode for these tests
  process.env.USE_MOCK_TEMPLATES = "false";
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("API /api/templates (SharePoint-backed)", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const res = await GET_TEMPLATES(makeReq("/api/templates") as unknown as NextRequest);
    expect(res.status).toBe(401);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns template list from SharePoint with no-store header", async () => {
    const { listTemplatesWithUserToken } = await import("@/lib/graph/templates");
    const mocked = vi.mocked(listTemplatesWithUserToken);

    mocked.mockResolvedValue([
      { key: "asset-checkout-v1", name: "Asset Checkout v1", itemId: "123", modified: "2024-06-01T00:00:00Z" },
      { key: "asset-checkout-v2", name: "Asset Checkout v2", itemId: "456", modified: "2024-08-15T00:00:00Z" },
    ]);

    const res = await GET_TEMPLATES(
      makeReq("/api/templates", "Bearer user-token") as unknown as NextRequest
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");

    const body = (await res.json()) as {
      templates: Array<{ key: string; name: string; itemId?: string; modified?: string; version?: string }>;
    };
    expect(Array.isArray(body.templates)).toBe(true);
    expect(body.templates.length).toBeGreaterThanOrEqual(2);
    expect(body.templates[0]).toMatchObject({ key: "asset-checkout-v1", name: "Asset Checkout v1" });
  });
});

describe("API /api/templates/[key] (SharePoint-backed)", () => {
  it("returns application/pdf bytes and no-store header for known key", async () => {
    const { getTemplateBytesWithUserToken } = await import("@/lib/graph/templates");
    const mocked = vi.mocked(getTemplateBytesWithUserToken);

    // Minimal '%PDF' header to emulate a PDF stream
    const fakePdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4
    mocked.mockResolvedValue(fakePdfBytes.buffer.slice(fakePdfBytes.byteOffset, fakePdfBytes.byteOffset + fakePdfBytes.byteLength));

    const key = "asset-checkout-v1";
    const res = await GET_TEMPLATE_BY_KEY(
      makeReq(`/api/templates/${key}`, "Bearer user-token") as unknown as NextRequest,
      { params: { key } } as unknown as { params: { key: string } }
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const ct = res.headers.get("Content-Type") || "";
    expect(ct.includes("application/pdf")).toBe(true);

    const ab = await res.arrayBuffer();
    const bytes = new Uint8Array(ab);
    const head = Buffer.from(bytes.slice(0, 4)).toString("ascii");
    expect(head).toBe("%PDF");
  });

  it("returns 404 for unknown key", async () => {
    const { getTemplateBytesWithUserToken } = await import("@/lib/graph/templates");
    const mocked = vi.mocked(getTemplateBytesWithUserToken);
    mocked.mockRejectedValue(Object.assign(new Error("not found"), { status: 404 }));

    const key = "does-not-exist";
    const res = await GET_TEMPLATE_BY_KEY(
      makeReq(`/api/templates/${key}`, "Bearer user-token") as unknown as NextRequest,
      { params: { key } } as unknown as { params: { key: string } }
    );

    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns 401 when Authorization header is missing", async () => {
    const key = "asset-checkout-v1";
    const res = await GET_TEMPLATE_BY_KEY(
      makeReq(`/api/templates/${key}`) as unknown as NextRequest,
      { params: { key } } as unknown as { params: { key: string } }
    );

    expect(res.status).toBe(401);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});
