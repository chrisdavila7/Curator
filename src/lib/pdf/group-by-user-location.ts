export type StagedOut = {
  asset: number;
  model: string;
  serial: string;
  to: string; // User/Location
};

export type GroupedChunk = {
  userLocation: string;
  chunks: Array<Array<Omit<StagedOut, "to">>>;
};

/**
 * Groups staged-out items by their "to" (User/Location) field and chunks each
 * group into arrays of up to `size` items (default 5). Preserves first-seen
 * group order and original item order within groups. Input is not mutated.
 */
export const groupAndChunk = (
  items: StagedOut[],
  size = 5
): GroupedChunk[] => {
  const chunkSize =
    Number.isFinite(size) && size > 0 ? Math.floor(size) : 5;

  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  // Preserve first-seen group order using Map insertion order
  const grouped = new Map<string, Array<Omit<StagedOut, "to">>>();

  for (const it of items) {
    const { to, asset, model, serial } = it;
    const entry = grouped.get(to);
    const record: Omit<StagedOut, "to"> = { asset, model, serial };
    if (entry) {
      entry.push(record);
    } else {
      grouped.set(to, [record]);
    }
  }

  const result: GroupedChunk[] = [];
  for (const [userLocation, arr] of grouped.entries()) {
    const chunks: Array<Array<Omit<StagedOut, "to">>> = [];
    for (let i = 0; i < arr.length; i += chunkSize) {
      chunks.push(arr.slice(i, i + chunkSize));
    }
    result.push({ userLocation, chunks });
  }
  return result;
};
