import { fillAndFlatten, printPdf } from "@/lib/pdf/pdf-fill";
import { mapToYubikeyHandReceipt, type YubikeyHandReceiptInput } from "@/lib/pdf/mappings/yubikey-hand-receipt";

type StagedOutMinimal = {
  asset: number;
  model: string;
  serial: string;
  to: string; // employee name or destination
};

export type GenerateYubikeyOptions = {
  getAuthHeaders: () => Promise<HeadersInit>;
  staged: StagedOutMinimal;
  userLocation: string;
  supervisor?: string;
  // Optional explicit dates; if not provided, use today's ISO (UTC) for all three
  dates?: { date1: string; date2: string; date3: string };
};

/**
 * End-to-end generator for:
 * Master Hand Receipts/Misc/Yubikey Hand Receipt.pdf
 *
 * Steps:
 * 1) GET /api/templates/Yubikey Hand Receipt (Authorization header if provided)
 * 2) Map current context to AcroForm fields
 * 3) fillAndFlatten on client
 * 4) printPdf (download/print only; uploads are disabled per requirements)
 */
export async function generateYubikeyReceipt(opts: GenerateYubikeyOptions): Promise<void> {
  const { getAuthHeaders, staged, userLocation, supervisor } = opts;

  const key = "Yubikey Hand Receipt";
  const encodedKey = encodeURIComponent(key);
  const headers = await getAuthHeaders().catch(() => ({} as HeadersInit));

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

  const todayIso = new Date().toISOString().slice(0, 10);
  const dates = opts.dates ?? { date1: todayIso, date2: todayIso, date3: todayIso };

  const mappingInput: YubikeyHandReceiptInput = {
    userLocation,
    employee: staged.to,
    supervisor,
    asset: {
      tag: String(staged.asset),
      model: staged.model,
      serial: staged.serial,
    },
    dates,
  };

  const fields = mapToYubikeyHandReceipt(mappingInput);
  const filled = await fillAndFlatten(templateBytes, fields);
  await printPdf(filled);
}
