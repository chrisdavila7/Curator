import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { fillAndFlatten } from "@/lib/pdf/pdf-fill";

// Utility to create a tiny AcroForm PDF template with a text field and a checkbox
const createTemplate = async (): Promise<Uint8Array> => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);

  const form = pdfDoc.getForm();

  const serialField = form.createTextField("Asset.Serial");
  serialField.addToPage(page, { x: 64, y: 700, width: 240, height: 18 });

  const checkedOut = form.createCheckBox("Asset.CheckedOut");
  checkedOut.addToPage(page, { x: 64, y: 660, width: 12, height: 12 });

  // Add visible labels so text extraction has stable context
  const { height } = page.getSize();
  page.drawText("Serial:", { x: 20, y: 700, size: 10 });
  page.drawText("Checked Out:", { x: 20, y: 660, size: 10 });

  return await pdfDoc.save();
};

// Extract all text from the first page using pdfjs-dist
const extractFirstPageText = async (bytes: Uint8Array): Promise<string> => {
  const loadingTask = pdfjsLib.getDocument({ data: bytes });
  const doc = (await loadingTask.promise) as {
    getPage: (n: number) => Promise<{
      getTextContent: () => Promise<{ items: Array<{ str: string }> }>;
    }>;
  };
  const page1 = await doc.getPage(1);
  const content = await page1.getTextContent();
  return content.items.map((i) => i.str).join(" ");
};

describe("pdf-fill utility", () => {
  it("fills text and checkbox fields, then flattens the form", async () => {
    const template = await createTemplate();

    const filled = await fillAndFlatten(template, {
      "Asset.Serial": "ABC123",
      "Asset.CheckedOut": true,
    });

    const text = await extractFirstPageText(filled);

    expect(text).toContain("Serial:");
    expect(text).toContain("ABC123");
    expect(text).toContain("Checked Out");

    // Ensure AcroForm dictionary has been removed by flattening
    const asLatin1 = Buffer.from(filled).toString("latin1");
    expect(asLatin1.includes("/AcroForm")).toBe(false);
  });

  it("ignores unknown fields without throwing", async () => {
    const template = await createTemplate();

    await expect(
      fillAndFlatten(template, {
        "Asset.Serial": "ZZZ999",
        "Nonexistent.Field": "ignored",
      })
    ).resolves.toBeInstanceOf(Uint8Array);
  });

  it("handles unchecking a checkbox", async () => {
    const template = await createTemplate();

    const filled = await fillAndFlatten(template, {
      "Asset.Serial": "SER-100",
      "Asset.CheckedOut": false,
    });

    // Still flattened and contains the serial text
    const text = await extractFirstPageText(filled);
    expect(text).toContain("SER-100");
    const asLatin1 = Buffer.from(filled).toString("latin1");
    expect(asLatin1.includes("/AcroForm")).toBe(false);
  });
});
