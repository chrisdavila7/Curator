import { describe, it, expect } from "vitest";
import { getAliasCandidates } from "@/lib/graph/users";

describe("getAliasCandidates", () => {
  it("generates up to three aliases from first name initials + last name", () => {
    expect(getAliasCandidates("John Doe")).toEqual(["jdoe", "jodoe", "johdoe"]);
    expect(getAliasCandidates("  John    Doe  ")).toEqual(["jdoe", "jodoe", "johdoe"]);
  });

  it("handles multi-part last names using the last token", () => {
    expect(getAliasCandidates("Mary Ann Smith")).toEqual(["msmith", "masmith", "marsmith"]);
  });

  it("returns empty array when input does not contain a space", () => {
    expect(getAliasCandidates("Madonna")).toEqual([]);
    expect(getAliasCandidates("")).toEqual([]);
  });

  it("sanitizes non-alphanumeric characters in last name", () => {
    // Allowed chars are a-z, 0-9, dot, underscore, dash
    expect(getAliasCandidates("Jean-Luc O'Neill")).toEqual(["joneill", "jeoneill", "jeaoneill"]);
  });

  it("truncates to the first 3 initials even if first name is longer", () => {
    expect(getAliasCandidates("Christopher Davila")).toEqual(["cdavila", "chdavila", "chrdavila"]);
  });
});
