import { fillAndFlatten } from "@/lib/pdf/pdf-fill";
import { mapToBlankHandReceipt, type BlankHandReceiptAsset } from "@/lib/pdf/mappings/blank-hand-receipt";

export type GenerateBlankHandReceiptOptions = {
  getAuthHeaders: () => Promise<HeadersInit>;
  assets: Array<{ asset: number; model: string; serial: string }>; // up to 5 (we'll truncate)
  employeeName: string; // User/Location value
  ctsRepName: string; // current user display name
  date?: string; // defaults to today (YYYY-MM-DD)
  templateKey?: string; // defaults to "Blank Hand Receipt"
  // Optional AD enrichment - when provided, map to PDF fields
  adCompany?: string; // maps to "Department/Location"
  adSupervisor?: string; // maps to "Supervisor"
};

/**
 * Fetches the "Blank Hand Receipt" template, maps fields per requirements,
 * fills and flattens the PDF, and returns the bytes. The caller is responsible
 * for preview/print/download UI.
 */
export async function generateBlankHandReceipt(
  opts: GenerateBlankHandReceiptOptions
): Promise<Uint8Array> {
  const {
    getAuthHeaders,
    assets,
    employeeName,
    ctsRepName,
    templateKey = "Blank Hand Receipt",
    adCompany,
    adSupervisor,
  } = opts;

  const rawDate = opts.date || new Date().toISOString().slice(0, 10);
  const toMmDdYyyy = (s: string): string => {
    const t = String(s || "").trim();
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/;
    const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const mIso = t.match(iso);
    if (mIso) {
      const [, y, m, d] = mIso;
      return `${m}/${d}/${y}`;
    }
    const mUs = t.match(us);
    if (mUs) {
      const [, m, d, y] = mUs;
      return `${m.padStart(2, "0")}/${d.padStart(2, "0")}/${y}`;
    }
    const dt = new Date(t);
    if (!isNaN(dt.getTime())) {
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      const dd = String(dt.getDate()).padStart(2, "0");
      const yyyy = String(dt.getFullYear());
      return `${mm}/${dd}/${yyyy}`;
    }
    // Fallback to today's date if unknown format
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const yyyy = String(now.getFullYear());
    return `${mm}/${dd}/${yyyy}`;
  };
  const date = toMmDdYyyy(rawDate);

  const headers = await getAuthHeaders().catch(() => ({} as HeadersInit));
  const encodedKey = encodeURIComponent(templateKey);

  // Optional debug: enumerate actual PDF field names to verify internal names
  if (process.env.NEXT_PUBLIC_DEBUG_PDF_FIELDS === "true") {
    try {
      const rf = await fetch(`/api/templates/${encodedKey}/fields`, {
        method: "GET",
        headers,
        cache: "no-store",
      });
      if (rf.ok) {
        const js = (await rf.json()) as { fields?: string[] };
        // eslint-disable-next-line no-console
        console.info("[PDF] Template fields:", Array.isArray(js.fields) ? js.fields : []);
      }
    } catch {
      // ignore debug errors
    }
  }

  const res = await fetch(`/api/templates/${encodedKey}`, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch template (${res.status})`);
  }

  const ab = await res.arrayBuffer();
  const templateBytes = new Uint8Array(ab);

  const mappedAssets: BlankHandReceiptAsset[] = assets.slice(0, 5).map((a) => ({
    tag: String(a.asset),
    model: a.model,
    serial: a.serial,
  }));

  const fields = mapToBlankHandReceipt({
    assets: mappedAssets,
    employeeName,
    ctsRepName,
    date, // already normalized to MM/DD/YYYY
  });

  // Optional AD enrichment. Leave blank on fallback per requirements.
  let augmentedFields = fields as Record<string, string>;

  // Some templates have slightly different internal field names than the visible labels.
  // Populate a set of common aliases so unknown/missing keys are safely ignored by pdf-fill.
  const setAliasValues = (names: string[], value: string) => {
    for (const n of names) {
      augmentedFields = { ...augmentedFields, [n]: value };
    }
  };

  if (adCompany && String(adCompany).trim().length > 0) {
    setAliasValues(
      [
        "Department/Location",
        "Department / Location",
        "Department - Location",
        "Department Location",
        "Dept/Location",
        "DepartmentLocation",
        "Department & Location",
        "Department and Location",
      ],
      adCompany
    );
  }
  if (adSupervisor && String(adSupervisor).trim().length > 0) {
    setAliasValues(
      [
        "Supervisor",
        "Supervisor Name",
        "Supervisor (Print)",
        "Supervisor Name (Print)",
        "Manager",
        "Manager Name",
      ],
      adSupervisor
    );
  }

  return await fillAndFlatten(templateBytes, augmentedFields);
}
