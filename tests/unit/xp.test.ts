import { describe, it, expect } from "vitest";
import { xpFor, xpForBatch, levelFromXp } from "@/lib/domain/xp";

describe("xp", () => {
  it("awards fixed XP for meaningful actions", () => {
    expect(xpFor("mission_completed").amount).toBe(20);
    expect(xpFor("milestone_reached").amount).toBe(60);
  });

  it("rewards returning after an absence", () => {
    expect(xpFor("returned_after_absence").amount).toBeGreaterThan(0);
  });

  it("applies diminishing returns to repeated same-type actions (no farming)", () => {
    const { total, awards } = xpForBatch([
      "mission_completed",
      "mission_completed",
      "mission_completed",
    ]);
    expect(awards[0]!.amount).toBe(20);
    expect(awards[1]!.amount).toBe(10);
    expect(awards[2]!.amount).toBe(5);
    expect(total).toBe(35);
  });

  it("computes a gentle, monotonic level curve", () => {
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(100).level).toBe(2);
    const a = levelFromXp(500).level;
    const b = levelFromXp(2000).level;
    expect(b).toBeGreaterThan(a);
  });
});
