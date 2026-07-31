import { describe, it, expect } from "vitest";
import { resourcesForDomain, readingPlan, horizonDays } from "@/lib/goals/resources";

describe("resources & reading pace", () => {
  it("recommends real finance books", () => {
    const r = resourcesForDomain("finance");
    expect(r.length).toBeGreaterThan(0);
    expect(r[0]!.title).toMatch(/psychology of money/i);
  });

  it("computes a concrete daily reading pace", () => {
    const book = resourcesForDomain("finance")[0]!; // ~256 pages
    const plan = readingPlan(book, 28);
    expect(plan.pagesPerDay).toBe(Math.ceil(book.pages / 28)); // ~10/day
    expect(plan.pagesPerDay).toBeGreaterThan(0);
  });

  it("handles programs (no pages) without dividing", () => {
    const c25k = resourcesForDomain("running")[0]!;
    const plan = readingPlan(c25k, 30);
    expect(plan.pagesPerDay).toBe(0);
  });

  it("derives a reading horizon from the goal timeframe", () => {
    const today = new Date("2026-08-01T00:00:00Z");
    expect(horizonDays(null, today)).toBe(28);
    const h = horizonDays("2027-02-01", today); // ~184 days /3 ≈ 61 → capped 56
    expect(h).toBeLessThanOrEqual(56);
    expect(h).toBeGreaterThanOrEqual(14);
  });

  it("falls back to a universal default for unknown domains", () => {
    expect(resourcesForDomain("mystery").length).toBeGreaterThan(0);
  });
});
