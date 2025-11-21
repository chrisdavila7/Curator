import { describe, it, expect } from "vitest";

import { groupAndChunk, type StagedOut, type GroupedChunk } from "@/lib/pdf/group-by-user-location";

const freezeDeep = <T>(arr: T[]): T[] => {
  for (const obj of arr as unknown as Record<string, unknown>[]) {
    Object.freeze(obj);
  }
  Object.freeze(arr);
  return arr;
};

describe("groupAndChunk", () => {
  it("returns empty array for empty input", () => {
    const input: StagedOut[] = [];
    const result = groupAndChunk(input);
    expect(result).toEqual([]);
  });

  it("groups by userLocation (to) and chunks into groups of 5, preserving order", () => {
    // 7 for John -> 5 + 2; 3 for Jane -> 3
    const john: StagedOut[] = Array.from({ length: 7 }, (_, i) => ({
      asset: 100 + i,
      model: `Model-J-${i}`,
      serial: `SN-J-${i}`,
      to: "John Doe",
    }));

    const jane: StagedOut[] = Array.from({ length: 3 }, (_, i) => ({
      asset: 200 + i,
      model: `Model-A-${i}`,
      serial: `SN-A-${i}`,
      to: "Jane Roe",
    }));

    const input = freezeDeep<StagedOut>([...john, ...jane]);

    const result = groupAndChunk(input);

    expect(result.length).toBe(2);

    // First seen group is John Doe
    expect(result[0].userLocation).toBe("John Doe");
    expect(result[0].chunks.length).toBe(2);
    expect(result[0].chunks[0].length).toBe(5);
    expect(result[0].chunks[1].length).toBe(2);
    // Order preserved within chunks
    expect(result[0].chunks[0][0].asset).toBe(100);
    expect(result[0].chunks[0][4].asset).toBe(104);
    expect(result[0].chunks[1][0].asset).toBe(105);
    expect(result[0].chunks[1][1].asset).toBe(106);

    // Second group is Jane Roe
    expect(result[1].userLocation).toBe("Jane Roe");
    expect(result[1].chunks.length).toBe(1);
    expect(result[1].chunks[0].length).toBe(3);
    expect(result[1].chunks[0][0].asset).toBe(200);
    expect(result[1].chunks[0][2].asset).toBe(202);
  });

  it("exactly 5 items yields a single chunk of 5", () => {
    const input = freezeDeep<StagedOut>(
      Array.from({ length: 5 }, (_, i) => ({
        asset: 300 + i,
        model: `M-${i}`,
        serial: `S-${i}`,
        to: "Alex Smith",
      }))
    );

    const result = groupAndChunk(input);
    expect(result.length).toBe(1);
    expect(result[0].userLocation).toBe("Alex Smith");
    expect(result[0].chunks.length).toBe(1);
    expect(result[0].chunks[0].length).toBe(5);
    expect(result[0].chunks[0][0].asset).toBe(300);
    expect(result[0].chunks[0][4].asset).toBe(304);
  });

  it("six items yields two chunks: 5 and 1", () => {
    const input = freezeDeep<StagedOut>(
      Array.from({ length: 6 }, (_, i) => ({
        asset: 400 + i,
        model: `M-${i}`,
        serial: `S-${i}`,
        to: "Pat Taylor",
      }))
    );

    const result = groupAndChunk(input);
    expect(result.length).toBe(1);
    expect(result[0].userLocation).toBe("Pat Taylor");
    expect(result[0].chunks.length).toBe(2);
    expect(result[0].chunks[0].length).toBe(5);
    expect(result[0].chunks[1].length).toBe(1);
    expect(result[0].chunks[1][0].asset).toBe(405);
  });

  it("preserves first-seen group order when inputs are interleaved", () => {
    const input = freezeDeep<StagedOut>([
      { asset: 1, model: "M1", serial: "S1", to: "Alpha" },
      { asset: 2, model: "M2", serial: "S2", to: "Beta" },
      { asset: 3, model: "M3", serial: "S3", to: "Alpha" },
      { asset: 4, model: "M4", serial: "S4", to: "Gamma" },
      { asset: 5, model: "M5", serial: "S5", to: "Beta" },
    ]);

    const result = groupAndChunk(input);
expect(result.map((g: GroupedChunk) => g.userLocation)).toEqual(["Alpha", "Beta", "Gamma"]);

    // Members remain in input order within each group
expect(result[0].chunks[0].map((a: Omit<StagedOut, "to">) => a.asset)).toEqual([1, 3]);
expect(result[1].chunks[0].map((a: Omit<StagedOut, "to">) => a.asset)).toEqual([2, 5]);
expect(result[2].chunks[0].map((a: Omit<StagedOut, "to">) => a.asset)).toEqual([4]);
  });
});
