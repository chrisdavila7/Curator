import { describe, it, expect } from "vitest";
import { startOfUtcDay, startOfUtcIsoWeek, startOfUtcMonth } from "@/lib/date-utc";

function iso(d: Date) {
  return d.toISOString();
}

describe("UTC date helpers", () => {
  describe("startOfUtcDay", () => {
    it("returns 00:00:00.000 UTC for a given date", () => {
      const d = new Date("2025-08-20T15:45:12.345Z");
      expect(iso(startOfUtcDay(d))).toBe("2025-08-20T00:00:00.000Z");
    });

    it("handles edge near midnight", () => {
      const d = new Date("2025-01-01T00:00:01.000Z");
      expect(iso(startOfUtcDay(d))).toBe("2025-01-01T00:00:00.000Z");
    });

    it("does not drift with local timezone/DST (UTC math only)", () => {
      const d = new Date("2025-03-30T22:15:00.000Z"); // Around DST changes in some locales
      expect(iso(startOfUtcDay(d))).toBe("2025-03-30T00:00:00.000Z");
    });
  });

  describe("startOfUtcIsoWeek (Monday 00:00 UTC)", () => {
    it("returns Monday for a Wednesday date", () => {
      const d = new Date("2025-08-20T15:45:00.000Z"); // Wed
      expect(iso(startOfUtcIsoWeek(d))).toBe("2025-08-18T00:00:00.000Z"); // Mon
    });

    it("returns same-day Monday boundary for a Monday date", () => {
      const d = new Date("2025-08-18T12:00:00.000Z"); // Mon
      expect(iso(startOfUtcIsoWeek(d))).toBe("2025-08-18T00:00:00.000Z");
    });

    it("returns previous Monday for a Sunday date", () => {
      const d = new Date("2025-08-24T08:00:00.000Z"); // Sun
      expect(iso(startOfUtcIsoWeek(d))).toBe("2025-08-18T00:00:00.000Z"); // Previous Mon
    });

    it("handles year-crossing weeks", () => {
      const d = new Date("2025-01-01T10:00:00.000Z"); // Wed
      expect(iso(startOfUtcIsoWeek(d))).toBe("2024-12-30T00:00:00.000Z"); // Monday of that ISO week
    });
  });

  describe("startOfUtcMonth", () => {
    it("returns first of month 00:00 UTC", () => {
      const d = new Date("2025-08-20T15:45:00.000Z");
      expect(iso(startOfUtcMonth(d))).toBe("2025-08-01T00:00:00.000Z");
    });

    it("handles first day already", () => {
      const d = new Date("2025-01-01T12:00:00.000Z");
      expect(iso(startOfUtcMonth(d))).toBe("2025-01-01T00:00:00.000Z");
    });

    it("handles varying month lengths", () => {
      const d = new Date("2025-03-31T23:59:59.000Z");
      expect(iso(startOfUtcMonth(d))).toBe("2025-03-01T00:00:00.000Z");
    });
  });
});
