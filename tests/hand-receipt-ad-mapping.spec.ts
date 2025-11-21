import { describe, it, expect, vi, beforeEach } from "vitest";

import { generateBlankHandReceipt } from "@/lib/pdf/generate-hand-receipt";
import * as PdfFill from "@/lib/pdf/pdf-fill";

describe("hand receipt AD enrichment integration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.USE_MOCK_TEMPLATES = "true";
  });

  it("includes Department/Location and Supervisor when adCompany and adSupervisor are provided", async () => {
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
    const outputBytes = new Uint8Array([1, 2, 3]);
    const fillSpy = vi
      .spyOn(PdfFill, "fillAndFlatten")
      .mockResolvedValue(outputBytes as unknown as Uint8Array);

    const getAuthHeaders = async () => ({}) as HeadersInit;

    // Act
    // Note: adCompany/adSupervisor are optional enrichment inputs passed through to the mapping
    const bytes = await generateBlankHandReceipt({
      getAuthHeaders,
      assets: [{ asset: 42, model: "Widget", serial: "SN-42" }],
      employeeName: "Jane Doe",
      ctsRepName: "John Smith",
      date: "2025-11-11",
      // New enrichment inputs
      adCompany: "Contoso Ltd",
      adSupervisor: "Ada Lovelace",
    } as unknown as Parameters<typeof generateBlankHandReceipt>[0]); // Ensure call compiles until types are updated

    // Assert
    expect(fillSpy).toHaveBeenCalledTimes(1);
    const args = fillSpy.mock.calls[0] as unknown[];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const fields = args[1] as Record<string, unknown>;

    expect(fields["Department/Location"]).toBe("Contoso Ltd");
    expect(fields["Supervisor"]).toBe("Ada Lovelace");

    // Existing fields still present
    expect(fields["Employee Name 1"]).toBe("Jane Doe");
    expect(fields["CTS Department Representative"]).toBe("John Smith");
    expect(bytes).toBe(outputBytes);
  });

  it("omits Department/Location and Supervisor when enrichment is not provided", async () => {
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
    const outputBytes = new Uint8Array([7, 7, 7]);
    const fillSpy = vi
      .spyOn(PdfFill, "fillAndFlatten")
      .mockResolvedValue(outputBytes as unknown as Uint8Array);

    const getAuthHeaders = async () => ({}) as HeadersInit;

    // Act
    const bytes = await generateBlankHandReceipt({
      getAuthHeaders,
      assets: [{ asset: 1, model: "M", serial: "S" }],
      employeeName: "U",
      ctsRepName: "Rep",
      date: "2025-11-11",
    });

    // Assert: fields should not contain enrichment keys
    const args = fillSpy.mock.calls[0] as unknown[];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const fields = args[1] as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(fields, "Department/Location")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(fields, "Supervisor")).toBe(false);
    expect(bytes).toBe(outputBytes);
  });

  it("sets common alias field variants for AD enrichment", async () => {
    // Arrange
    const pdfHeader = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () =>
        pdfHeader.buffer.slice(pdfHeader.byteOffset, pdfHeader.byteOffset + pdfHeader.byteLength),
      headers: new Headers({ "Content-Type": "application/pdf" }),
    } as Response);
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

    const outputBytes = new Uint8Array([2, 2, 2]);
    const fillSpy = vi
      .spyOn(PdfFill, "fillAndFlatten")
      .mockResolvedValue(outputBytes as unknown as Uint8Array);

    const getAuthHeaders = async () => ({}) as HeadersInit;

    // Act
    await generateBlankHandReceipt({
      getAuthHeaders,
      assets: [{ asset: 7, model: "A", serial: "B" }],
      employeeName: "X",
      ctsRepName: "Y",
      date: "2025-11-11",
      adCompany: "Contoso Ltd",
      adSupervisor: "Ada Lovelace",
    } as unknown as Parameters<typeof generateBlankHandReceipt>[0]);

    // Assert: verify a couple of alias variants exist in addition to canonical names
    const args = fillSpy.mock.calls[0] as unknown[];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const fields = args[1] as Record<string, unknown>;
    expect(fields["Department/Location"]).toBe("Contoso Ltd");
    expect(fields["Department / Location"]).toBe("Contoso Ltd"); // alias
    expect(fields["Supervisor"]).toBe("Ada Lovelace");
    expect(fields["Supervisor Name"]).toBe("Ada Lovelace"); // alias
  });
});
