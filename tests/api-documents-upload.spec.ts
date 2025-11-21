// @vitest-environment node
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import type { NextRequest } from "next/server";

// Route under test
import { POST as POST_DOCUMENT } from "@/app/api/documents/route";

// Mock the SharePoint upload helper that the route will call
vi.mock("@/lib/graph/templates", () => {
  return {
    uploadPdfWithUserToken: vi.fn(),
  };
});

beforeAll(() => {
  // Enable save endpoint by default in this suite
  process.env.ENABLE_SHAREPOINT_SAVE = "true";
});

afterEach(() => {
  vi.clearAllMocks();
});

const makeBinaryRequest = (bytes: Uint8Array, qs: string, auth = "Bearer user-token"): NextRequest => {
  // Ensure ArrayBuffer (not SharedArrayBuffer)
  const ab = new ArrayBuffer(bytes.length);
  new Uint8Array(ab).set(bytes);
  const req = new Request(`http://localhost/api/documents?${qs}`, {
    method: "POST",
    headers: {
      "content-type": "application/octet-stream",
      authorization: auth,
    },
    body: ab,
  });
  return req as unknown as NextRequest;
};

const makeJsonRequest = (body: unknown, auth = "Bearer user-token"): NextRequest => {
  const req = new Request("http://localhost/api/documents", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: auth,
    },
    body: JSON.stringify(body),
  });
  return req as unknown as NextRequest;
};

describe("POST /api/documents (SharePoint upload)", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const res = await POST_DOCUMENT(makeBinaryRequest(bytes, "fileName=test.pdf", ""));
    expect(res.status).toBe(401);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns 404 when feature is disabled", async () => {
    process.env.ENABLE_SHAREPOINT_SAVE = "false";
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const res = await POST_DOCUMENT(makeBinaryRequest(bytes, "fileName=test.pdf"));
    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    // Restore flag for subsequent tests
    process.env.ENABLE_SHAREPOINT_SAVE = "true";
  });

  it("accepts application/octet-stream and returns 201 with id/webUrl/eTag", async () => {
    const { uploadPdfWithUserToken } = await import("@/lib/graph/templates");
    const mocked = vi.mocked(uploadPdfWithUserToken);

    mocked.mockResolvedValue({
      id: "driveItemId123",
      webUrl: "https://contoso.sharepoint.com/sites/Inventory/Shared%20Documents/test.pdf",
      eTag: '"{ABC123}"',
    });

    const bytes = new Uint8Array(1024); // small payload
    const fileName = "HQ asset-checkout-v1 UNSIGNED.pdf";
    const res = await POST_DOCUMENT(makeBinaryRequest(bytes, `fileName=${encodeURIComponent(fileName)}&assetId=1001&templateKey=asset-checkout-v1`));
    expect(res.status).toBe(201);
    expect(res.headers.get("Cache-Control")).toBe("no-store");

    const body = (await res.json()) as { id: string; webUrl?: string; eTag?: string };
    expect(body.id).toBe("driveItemId123");
    expect(body.webUrl).toContain("test.pdf"); // from mock
    expect(typeof body.eTag === "string" || typeof body.eTag === "undefined").toBe(true);

    // Ensure helper called once with correct args
    expect(mocked).toHaveBeenCalledTimes(1);
    const [userToken, opts] = mocked.mock.calls[0];
    expect(typeof userToken).toBe("string");
    expect((opts as { fileName: string }).fileName).toBe(fileName);
    expect((opts as { bytes: ArrayBuffer }).bytes).toBeInstanceOf(ArrayBuffer);
  });

  it("accepts application/json with base64 payload and returns 201", async () => {
    const { uploadPdfWithUserToken } = await import("@/lib/graph/templates");
    const mocked = vi.mocked(uploadPdfWithUserToken);

    mocked.mockResolvedValue({
      id: "driveItemId456",
      webUrl: "https://contoso.sharepoint.com/sites/Inventory/Shared%20Documents/from-json.pdf",
      eTag: '"{DEF456}"',
    });

    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
    const base64 = Buffer.from(bytes).toString("base64");

    const res = await POST_DOCUMENT(
      makeJsonRequest({
        fileName: "HQ asset-checkout-v1 UNSIGNED.pdf",
        templateKey: "asset-checkout-v1",
        assetId: "1001",
        bytesBase64: base64,
      })
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; webUrl?: string; eTag?: string };
    expect(body.id).toBe("driveItemId456");
  });

  it("returns 400 when fileName is missing", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const res = await POST_DOCUMENT(makeBinaryRequest(bytes, ""));
    expect(res.status).toBe(400);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});
