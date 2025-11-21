import { PDFDocument, PDFForm } from "pdf-lib";

export type PdfFieldValue = string | boolean | number | Date;

const toIsoDate = (d: Date): string => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const toStringValue = (v: Exclude<PdfFieldValue, boolean>): string => {
  if (v instanceof Date) return toIsoDate(v);
  return String(v);
};

const tryGetTextField = (form: PDFForm, name: string) => {
  try {
    return form.getTextField(name);
  } catch {
    return null;
  }
};

const tryGetCheckBox = (form: PDFForm, name: string) => {
  try {
    return form.getCheckBox(name);
  } catch {
    return null;
  }
};

/**
 * Fill an AcroForm PDF template with given field values and flatten the form.
 * - Booleans target checkboxes (checked/unchecked)
 * - Other values are stringified and written to text fields
 * - Unknown/missing fields are ignored (no-throw)
 */
export async function fillAndFlatten(
  template: ArrayBuffer | Uint8Array,
  fields: Record<string, PdfFieldValue>,
  options?: { updateAppearances?: boolean }
): Promise<Uint8Array> {
  const bytes = template instanceof Uint8Array ? template : new Uint8Array(template);
  const pdfDoc = await PDFDocument.load(bytes);

  const form = pdfDoc.getForm();

  for (const [name, raw] of Object.entries(fields)) {
    if (typeof raw === "boolean") {
      const cb = tryGetCheckBox(form, name);
      if (cb) {
        raw ? cb.check() : cb.uncheck();
      }
      continue;
    }

    const tf = tryGetTextField(form, name);
    if (tf) {
      tf.setText(toStringValue(raw));
    }
  }

  form.flatten();
  return await pdfDoc.save();
}

/**
 * Trigger a client-side download of the given PDF bytes.
 * Browser-only. No-ops in non-DOM environments.
 */
export async function downloadPdf(bytes: Uint8Array, filename: string): Promise<void> {
  if (typeof window === "undefined") return;
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const blob = new Blob([ab], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Print the given PDF bytes using a hidden iframe.
 * Browser-only. No-ops in non-DOM environments.
 */
export async function printPdf(bytes: Uint8Array): Promise<void> {
  if (typeof window === "undefined") return;
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const blob = new Blob([ab], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  iframe.src = url;
  document.body.appendChild(iframe);
  await new Promise<void>((resolve) => {
    iframe.onload = () => resolve();
  });
  try {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
  } finally {
    setTimeout(() => {
      URL.revokeObjectURL(url);
      iframe.remove();
    }, 1000);
  }
}
