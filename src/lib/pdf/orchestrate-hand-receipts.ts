import { generateBlankHandReceipt, type GenerateBlankHandReceiptOptions } from "@/lib/pdf/generate-hand-receipt";
import { groupAndChunk, type StagedOut } from "@/lib/pdf/group-by-user-location";

export type OrchestrateOptions = {
  getAuthHeaders: () => Promise<HeadersInit>;
  stagedOut: StagedOut[];
  ctsRepName: string;
  date?: string;
  templateKey?: string; // defaults to "Blank Hand Receipt" in generator
};

export type OrchestrateResultItem = {
  userLocation: string;
  bytes: Uint8Array;
};

/**
 * Groups staged-out assets by User/Location, performs one AD resolve per group,
 * and generates one PDF per chunk (up to 5 assets each). Returns results in
 * stable order of first-seen groups and chunk order within each group.
 */
export const orchestrateHandReceipts = async (
  opts: OrchestrateOptions
): Promise<OrchestrateResultItem[]> => {
  const { getAuthHeaders, stagedOut, ctsRepName, date, templateKey } = opts;

  const groups = groupAndChunk(stagedOut);
  const results: OrchestrateResultItem[] = [];

  for (const group of groups) {
    const userLocation = group.userLocation;

    // Resolve AD enrichment once per group; leave blank on any fallback/error.
    let adCompany: string | undefined;
    let adSupervisor: string | undefined;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/directory/resolve?query=${encodeURIComponent(userLocation)}`, {
        method: "GET",
        headers,
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as {
          user: { companyName?: string } | null;
          manager: { displayName?: string } | null;
        };
        if (data.user?.companyName && data.user.companyName.trim().length > 0) {
          adCompany = data.user.companyName;
        }
        if (data.manager?.displayName && data.manager.displayName.trim().length > 0) {
          adSupervisor = data.manager.displayName;
        }
      }
    } catch {
      // Ignore resolver errors; proceed with blanks.
    }

    for (const chunk of group.chunks) {
      const genOpts: GenerateBlankHandReceiptOptions = {
        getAuthHeaders,
        assets: chunk.map((a) => ({ asset: a.asset, model: a.model, serial: a.serial })),
        employeeName: userLocation,
        ctsRepName,
        date,
        templateKey,
        adCompany,
        adSupervisor,
      };

      const bytes = await generateBlankHandReceipt(genOpts);
      results.push({ userLocation, bytes });
    }
  }

  return results;
};
