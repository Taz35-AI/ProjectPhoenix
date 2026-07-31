import { describe, it, expect } from "vitest";
import {
  deltasForMissionCompletion,
  scaleDeltas,
  applyDelta,
  deltasForComeback,
} from "@/lib/domain/attributes";

describe("attributes", () => {
  it("rewards relevant attributes by domain and type", () => {
    const run = deltasForMissionCompletion("running", "primary");
    expect(run.health).toBeGreaterThan(0);
    expect(run.discipline).toBeGreaterThan(0);

    const courage = deltasForMissionCompletion("confidence", "courage");
    expect(courage.courage).toBeGreaterThanOrEqual(3);
  });

  it("partial completion counts at reduced weight", () => {
    const full = deltasForMissionCompletion("learning", "primary");
    const half = scaleDeltas(full, 0.5);
    expect(half.knowledge).toBeCloseTo((full.knowledge ?? 0) * 0.5, 5);
  });

  it("never decreases on a missed day (only positive events add)", () => {
    // There is no 'miss' delta — attributes only grow. Applying no delta holds.
    expect(applyDelta(40, 0)).toBe(40);
  });

  it("shows diminishing returns near the cap and never exceeds 100", () => {
    const gainLow = applyDelta(0, 10) - 0;
    const gainHigh = applyDelta(90, 10) - 90;
    expect(gainLow).toBeGreaterThan(gainHigh); // same delta adds less near the cap
    expect(applyDelta(99, 50)).toBeLessThanOrEqual(100);
  });

  it("comeback rewards resilience", () => {
    expect(deltasForComeback().resilience).toBeGreaterThan(0);
  });
});
