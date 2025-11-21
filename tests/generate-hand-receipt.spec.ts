import { describe, it, expect, vi, beforeEach } from "vitest";

import { generateBlankHandReceipt } from "@/lib/pdf/generate-hand-receipt";
import * as PdfFill from "@/lib/pdf/pdf-fill";

describe("generateBlankHandReceipt", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.USE_MOCK_TEMPLATES = "true";
  });

  it("fetches Blank Hand Receipt, maps fields, calls fillAndFlatten, and returns bytes", async () => {
    // Arrange: stub fetch for template bytes
    const pdfHeader = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () =>
        pdfHeader.buffer.slice(pdfHeader.byteOffset, pdfHeader.byteOffset + pdfHeader.byteLength),
      headers: new Headers({ "Content-Type": "application/pdf" }),
    } as Response);
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

    // Spy and stub fillAndFlatten
    const outputBytes = new Uint8Array([9, 9, 9]);
    const fillSpy = vi
      .spyOn(PdfFill, "fillAndFlatten")
      .mockResolvedValue(outputBytes as unknown as Uint8Array);

    const getAuthHeaders = async () => ({}) as HeadersInit;

    const bytes = await generateBlankHandReceipt({
      getAuthHeaders,
      assets: [{ asset: 1323, model: "Model-X", serial: "SN-1323" }],
      employeeName: "Jane Doe",
      ctsRepName: "John Smith",
      date: "2025-11-11",
    });

    // URL used
    const url = (fetchMock.mock.calls[0]?.[0] ?? "") as string | URL;
    const urlStr = typeof url === "string" ? url : url.toString();
    expect(urlStr).toContain("/api/templates/Blank%20Hand%20Receipt");

    // fillAndFlatten called with expected field set
    expect(fillSpy).toHaveBeenCalledTimes(1);
    const args = fillSpy.mock.calls[0] as unknown[];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const fields = args[1] as Record<string, unknown>;

    expect(fields["Employee Name 1"]).toBe("Jane Doe");
    expect(fields["Date 1"]).toBe("11/11/2025");
    expect(fields["Asset Tag 1"]).toBe("1323");
    expect(fields["Asset Name/Model 1"]).toBe("Model-X");
    expect(fields["Serial Number 1"]).toBe("SN-1323");
    expect(Object.prototype.hasOwnProperty.call(fields, "Replacement Cost 1")).toBe(false);
    expect(fields["CTS Department Representative"]).toBe("John Smith");
    expect(fields["Date 3"]).toBe("11/11/2025");

    // Left-blank fields should not be present
    expect(Object.prototype.hasOwnProperty.call(fields, "Department/Location")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(fields, "Supervisor")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(fields, "Employee Name (Print)")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(fields, "Date 2")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(fields, "CTS Department Representative 2")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(fields, "Date 4")).toBe(false);

    // Return value
    expect(bytes).toBe(outputBytes);
  });

  it("throws when template fetch fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
    const getAuthHeaders = async () => ({}) as HeadersInit;

    await expect(
      generateBlankHandReceipt({
        getAuthHeaders,
        assets: [{ asset: 1, model: "M", serial: "S" }],
        employeeName: "U",
        ctsRepName: "Rep",
      })
    ).rejects.toThrow(/Failed to fetch template \(404\)/i);
  });
});
