import { describe, it, expect, vi, beforeEach } from "vitest";

import * as PdfFill from "@/lib/pdf/pdf-fill";
import { orchestrateHandReceipts } from "@/lib/pdf/orchestrate-hand-receipts";
import type { StagedOut } from "@/lib/pdf/group-by-user-location";

describe("orchestrateHandReceipts", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.USE_MOCK_TEMPLATES = "true";
  });

  it("groups by userLocation, resolves AD once per group, and generates one PDF per up to 5 assets", async () => {
    // Arrange stagedOut: 7 for John (=> 2 PDFs: 5 + 2), 3 for Jane (=> 1 PDF)
    const stagedOut: StagedOut[] = [
      // John Doe (7 assets)
      { asset: 100, model: "J-Model-0", serial: "J-SN-0", to: "John Doe" },
      { asset: 101, model: "J-Model-1", serial: "J-SN-1", to: "John Doe" },
      { asset: 102, model: "J-Model-2", serial: "J-SN-2", to: "John Doe" },
      { asset: 103, model: "J-Model-3", serial: "J-SN-3", to: "John Doe" },
      { asset: 104, model: "J-Model-4", serial: "J-SN-4", to: "John Doe" },
      { asset: 105, model: "J-Model-5", serial: "J-SN-5", to: "John Doe" },
      { asset: 106, model: "J-Model-6", serial: "J-SN-6", to: "John Doe" },
      // Jane Roe (3 assets)
      { asset: 200, model: "A-Model-0", serial: "A-SN-0", to: "Jane Roe" },
      { asset: 201, model: "A-Model-1", serial: "A-SN-1", to: "Jane Roe" },
      { asset: 202, model: "A-Model-2", serial: "A-SN-2", to: "Jane Roe" },
    ];

    // Stub fetch for both template retrieval and directory resolve
    const pdfHeader = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/templates/")) {
        // Return template bytes
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () =>
            pdfHeader.buffer.slice(pdfHeader.byteOffset, pdfHeader.byteOffset + pdfHeader.byteLength),
          headers: new Headers({ "Content-Type": "application/pdf" }),
        } as unknown as Response;
      }
      if (url.includes("/api/directory/resolve")) {
        const query = new URL(url, "http://localhost").searchParams.get("query") || "";
        if (query === "John Doe") {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              user: { companyName: "Contoso Ltd" },
              manager: { displayName: "Ada Lovelace" },
            }),
            headers: new Headers({ "Content-Type": "application/json" }),
          } as unknown as Response;
        }
        if (query === "Jane Roe") {
          // Simulate a failed resolve for Jane => enrichment should remain blank
          return {
            ok: false,
            status: 502,
            json: async () => ({ error: "Directory lookup failed" }),
            headers: new Headers({ "Content-Type": "application/json" }),
          } as unknown as Response;
        }
      }
      throw new Error(`Unexpected fetch URL: ${url} ${init?.method ?? ""}`);
    });
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

    // Spy and stub fillAndFlatten to capture fields per generated PDF
    const bytes1 = new Uint8Array([1]);
    const bytes2 = new Uint8Array([2]);
    const bytes3 = new Uint8Array([3]);
    const fillSpy = vi
      .spyOn(PdfFill, "fillAndFlatten")
      .mockResolvedValueOnce(bytes1 as unknown as Uint8Array) // John chunk 1 (5 assets)
      .mockResolvedValueOnce(bytes2 as unknown as Uint8Array) // John chunk 2 (2 assets)
      .mockResolvedValueOnce(bytes3 as unknown as Uint8Array); // Jane chunk (3 assets)

    const getAuthHeaders = async () => ({}) as HeadersInit;
    const ctsRepName = "Current User";
    const date = "2025-11-11";

    // Act
    const results = await orchestrateHandReceipts({
      getAuthHeaders,
      stagedOut,
      ctsRepName,
      date,
      templateKey: "Blank Hand Receipt",
    });

    // Assert: three PDFs total, in stable group order
    expect(results.length).toBe(3);
    expect(results[0].userLocation).toBe("John Doe");
    expect(results[1].userLocation).toBe("John Doe");
    expect(results[2].userLocation).toBe("Jane Roe");

    // One directory resolve per distinct userLocation
    const resolveCalls = fetchMock.mock.calls.filter(
      (c) => typeof c[0] === "string" && (c[0] as string).includes("/api/directory/resolve")
    );
    expect(resolveCalls.length).toBe(2);

    // fillAndFlatten called once per chunk
    expect(fillSpy).toHaveBeenCalledTimes(3);

    // Inspect fields for first John chunk (5 assets): enrichment present
    {
      const args = fillSpy.mock.calls[0] as unknown[];
      const fields = args[1] as Record<string, unknown>;
      expect(fields["Employee Name 1"]).toBe("John Doe");
      expect(fields["Date 1"]).toBe("11/11/2025"); // normalized
      expect(fields["Asset Tag 1"]).toBe("100");
      expect(fields["Asset Tag 5"]).toBe("104");
      expect(Object.prototype.hasOwnProperty.call(fields, "Replacement Cost 5")).toBe(false);
      // Enrichment present via alias keys
      expect(fields["Department/Location"]).toBe("Contoso Ltd");
      expect(fields["Supervisor"]).toBe("Ada Lovelace");
      expect(fields["CTS Department Representative"]).toBe(ctsRepName);
      expect(fields["Date 3"]).toBe("11/11/2025");
    }

    // Inspect fields for second John chunk (2 assets): only slots 1..2 present, enrichment present
    {
      const args = fillSpy.mock.calls[1] as unknown[];
      const fields = args[1] as Record<string, unknown>;
      expect(fields["Employee Name 1"]).toBe("John Doe");
      expect(fields["Asset Tag 1"]).toBe("105");
      expect(fields["Asset Tag 2"]).toBe("106");
      // Slots 3..5 should not exist
      expect(Object.prototype.hasOwnProperty.call(fields, "Asset Tag 3")).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(fields, "Asset Tag 4")).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(fields, "Asset Tag 5")).toBe(false);
      // Enrichment present
      expect(fields["Department/Location"]).toBe("Contoso Ltd");
      expect(fields["Supervisor"]).toBe("Ada Lovelace");
    }

    // Inspect fields for Jane chunk (3 assets): enrichment omitted on failed resolve
    {
      const args = fillSpy.mock.calls[2] as unknown[];
      const fields = args[1] as Record<string, unknown>;
      expect(fields["Employee Name 1"]).toBe("Jane Roe");
      expect(fields["Asset Tag 1"]).toBe("200");
      expect(fields["Asset Tag 3"]).toBe("202");
      expect(Object.prototype.hasOwnProperty.call(fields, "Department/Location")).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(fields, "Supervisor")).toBe(false);
    }

    // Returned bytes match spy results in order
    expect(results[0].bytes).toBe(bytes1);
    expect(results[1].bytes).toBe(bytes2);
    expect(results[2].bytes).toBe(bytes3);
  });
});
