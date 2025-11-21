import { describe, it, expect, vi, beforeEach } from "vitest";

import { generateYubikeyReceipt } from "@/lib/pdf/generate-yubikey";
import * as PdfFill from "@/lib/pdf/pdf-fill";

describe("generateYubikeyReceipt", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Ensure templates API can be called without Authorization for tests
    process.env.USE_MOCK_TEMPLATES = "true";
  });

  it("fetches the Yubikey template, fills with mapped fields, and prints", async () => {
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

    // Stub fillAndFlatten to return "flattened" bytes and spy printPdf
    const filledBytes = new Uint8Array([1, 2, 3, 4]);
    const fillSpy = vi.spyOn(PdfFill, "fillAndFlatten").mockResolvedValue(filledBytes);
    const printSpy = vi.spyOn(PdfFill, "printPdf").mockResolvedValue();


    // Minimal getAuthHeaders that returns empty in tests
    const getAuthHeaders = async () => ({}) as HeadersInit;

    const staged = { asset: 1323, model: "Yubikey 5 NFC", serial: "YK-ABC-123", to: "Jane Doe" };
    const userLocation = "HQ";

    // Act
    await generateYubikeyReceipt({ getAuthHeaders, staged, userLocation });

    // Assert: Template was fetched using our route and key
    const calls = (fetchMock as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    const firstUrl = calls[0]?.[0];
    expect(typeof firstUrl === "string" ? firstUrl : (firstUrl as URL).toString()).toContain(
      "/api/templates/Yubikey%20Hand%20Receipt"
    );


    // Fill and print invoked
    expect(fillSpy).toHaveBeenCalledTimes(1);
    expect(printSpy).toHaveBeenCalledWith(filledBytes);
  });

  it("throws an error when template fetch fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

    const getAuthHeaders = async () => ({}) as HeadersInit;
    const staged = { asset: 1, model: "Yubikey", serial: "SN", to: "User" };

    await expect(
      generateYubikeyReceipt({ getAuthHeaders, staged, userLocation: "HQ" })
    ).rejects.toThrow(/failed/i);
  });
});
