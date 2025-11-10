// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { GET } from "@/app/api/inventory/route";
import type { InventoryItem } from "@/types/inventory";
import { startOfUtcMonth, startOfUtcIsoWeek, startOfUtcDay } from "@/lib/date-utc";
import { mockInventory } from "@/data/inventory";

// Minimal NextRequest-like stub for our GET handler (we only need nextUrl.searchParams + headers.get)
function makeReq(url: string) {
  const u = new URL(url, "http://localhost");
  const searchParams = u.searchParams;
  const headers = new Headers();
  return { nextUrl: { searchParams }, headers } as any;
}

beforeAll(() => {
  // Force mock mode for all tests
  process.env.USE_MOCK_INVENTORY = "true";
  // Lock "now" so UTC boundaries are deterministic
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2025-08-20T12:00:00.000Z"));
});

afterAll(() => {
  vi.useRealTimers();
});

describe("API /api/inventory (mock mode)", () => {
  it("returns full inventory with no-store cache header by default", async () => {
    const res = await GET(makeReq("/api/inventory"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const data = (await res.json()) as InventoryItem[];
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(mockInventory.length);
  });

  it("returns recent=N items sorted by modified/created desc", async () => {
    const res = await GET(makeReq("/api/inventory?recent=3"));
    expect(res.status).toBe(200);
    const data = (await res.json()) as InventoryItem[];
    expect(data.length).toBe(3);

    const toMs = (s?: string) => (s ? new Date(s).getTime() : 0);
    const ms = data.map((i) => toMs(i.modified || i.created));
    // monotonic non-increasing
    expect(ms[0]).toBeGreaterThanOrEqual(ms[1]);
    expect(ms[1]).toBeGreaterThanOrEqual(ms[2]);
  });

  it("filters deployedSince=month from UTC month start", async () => {
    const now = new Date(); // 2025-08-20
    const since = startOfUtcMonth(now).getTime();

    const res = await GET(makeReq("/api/inventory?deployedSince=month"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const data = (await res.json()) as InventoryItem[];

    // Only deployed items and >= month start
    for (const item of data) {
      expect(item.status).toBe("deployed");
      const t = new Date(item.modified || item.created).getTime();
      expect(t).toBeGreaterThanOrEqual(since);
    }

    // For our mock data set in August 2025, there are 5 deployed entries in-month.
    expect(data.length).toBe(5);
  });

  it("filters deployedSince=week from UTC ISO week (Mon) start", async () => {
    const now = new Date(); // 2025-08-20 (Wed), ISO week start = 2025-08-18
    const since = startOfUtcIsoWeek(now).getTime();

    const res = await GET(makeReq("/api/inventory?deployedSince=week"));
    expect(res.status).toBe(200);
    const data = (await res.json()) as InventoryItem[];

    for (const item of data) {
      expect(item.status).toBe("deployed");
      const t = new Date(item.modified || item.created).getTime();
      expect(t).toBeGreaterThanOrEqual(since);
    }

    // With fixed mock data and this "now", expect none deployed since Monday 18th.
    expect(data.length).toBe(0);
  });

  it("filters deployedSince=today from UTC day start", async () => {
    const now = new Date(); // 2025-08-20
    const since = startOfUtcDay(now).getTime();

    const res = await GET(makeReq("/api/inventory?deployedSince=today"));
    expect(res.status).toBe(200);
    const data = (await res.json()) as InventoryItem[];

    for (const item of data) {
      expect(item.status).toBe("deployed");
      const t = new Date(item.modified || item.created).getTime();
      expect(t).toBeGreaterThanOrEqual(since);
    }

    // With fixed mock data and this "now", there are no deployed items today.
    expect(data.length).toBe(0);
  });
});
