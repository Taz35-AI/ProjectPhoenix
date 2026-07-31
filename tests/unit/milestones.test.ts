import { describe, it, expect } from "vitest";
import { generateRoadmap, extractKg, type RoadmapGoal } from "@/lib/domain/milestones";

const today = new Date("2026-08-01T00:00:00.000Z");

function goal(overrides: Partial<RoadmapGoal>): RoadmapGoal {
  return { domain: "health", displayTitle: "", rawInput: "", currentState: null, targetState: null, targetDate: null, ...overrides };
}

describe("milestone engine", () => {
  it("extracts kg values from free text", () => {
    expect(extractKg("Lose 26 kg from 112 kg to 86 kg")).toEqual([26, 112, 86]);
  });

  it("builds a safe, dated weight-loss roadmap ending at the target", () => {
    const r = generateRoadmap(goal({ rawInput: "Lose 26 kg from 112 kg to 86 kg" }), today);
    expect(r.method).toBe("weight_safe_rate");
    expect(r.milestones.length).toBeGreaterThanOrEqual(3);
    const last = r.milestones[r.milestones.length - 1]!;
    expect(last.targetValue).toBe(86);
    // every milestone is dated and dates strictly increase (safe pacing)
    const dates = r.milestones.map((m) => m.targetDate!);
    expect(dates.every(Boolean)).toBe(true);
    for (let i = 1; i < dates.length; i++) expect(dates[i]! > dates[i - 1]!).toBe(true);
    // never suggests losing it all in an unsafe timeframe: ~26kg @0.7/wk ≈ >30 weeks
    expect(Date.parse(last.targetDate!) - today.getTime()).toBeGreaterThan(30 * 7 * 86_400_000);
    expect(r.note).toMatch(/not medical advice/i);
  });

  it("weight targets descend monotonically toward the goal", () => {
    const r = generateRoadmap(goal({ rawInput: "112 kg to 86 kg" }), today);
    const vals = r.milestones.map((m) => m.targetValue!);
    for (let i = 1; i < vals.length; i++) expect(vals[i]! < vals[i - 1]!).toBe(true);
  });

  it("uses even increments for a numeric goal like savings", () => {
    const r = generateRoadmap(goal({ domain: "finance", rawInput: "Save £10,000", targetState: "£10,000" }), today);
    expect(r.method).toBe("numeric_increments");
    expect(r.milestones[r.milestones.length - 1]!.targetValue).toBe(10000);
  });

  it("falls back to time-boxed phases when there are no numbers", () => {
    const r = generateRoadmap(goal({ domain: "confidence", rawInput: "Become more confident", displayTitle: "Become more confident" }), today);
    expect(r.method).toBe("time_phases");
    expect(r.milestones).toHaveLength(3);
    expect(r.milestones.every((m) => m.targetDate)).toBe(true);
  });
});
