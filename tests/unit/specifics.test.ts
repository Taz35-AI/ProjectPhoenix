import { describe, it, expect } from "vitest";
import { fieldsForDomain, buildGoalUpdate } from "@/lib/goals/specifics";
import { generateRoadmap, type RoadmapGoal } from "@/lib/domain/milestones";

const today = new Date("2026-08-01T00:00:00.000Z");

describe("goal specifics", () => {
  it("asks weight questions for health goals", () => {
    const keys = fieldsForDomain("health").map((f) => f.key);
    expect(keys).toContain("currentWeight");
    expect(keys).toContain("targetWeight");
    expect(keys).toContain("timeframe");
  });

  it("builds structured weight fields + a metric from numbers", () => {
    const u = buildGoalUpdate("health", { currentWeight: "95", targetWeight: "80", timeframe: "6m" }, today);
    expect(u.currentState).toBe("95 kg");
    expect(u.targetState).toBe("80 kg");
    expect(u.targetDate).toBe("2027-01-28"); // +180 days
    expect(u.metric).toMatchObject({ unit: "kg", baseline: 95, target: 80 });
  });

  it("builds a finance target with currency", () => {
    const u = buildGoalUpdate("finance", { targetAmount: "5000", timeframe: "12m" }, today);
    expect(u.targetState).toBe("£5000");
    expect(u.metric?.target).toBe(5000);
  });
});

describe("roadmap honours timeframe safely", () => {
  function goal(o: Partial<RoadmapGoal>): RoadmapGoal {
    return { domain: "health", displayTitle: "", rawInput: "", currentState: "95 kg", targetState: "80 kg", targetDate: null, ...o };
  }

  it("paces to a comfortable timeframe", () => {
    const r = generateRoadmap(goal({ targetDate: "2027-02-01" }), today); // ~26 weeks for 15kg → ~0.58/wk (safe)
    const last = r.milestones[r.milestones.length - 1]!;
    expect(last.targetValue).toBe(80);
    // final date is on/around the requested date, not wildly past it
    expect(Math.abs(Date.parse(last.targetDate!) - Date.parse("2027-02-01"))).toBeLessThan(20 * 86_400_000);
  });

  it("caps an unsafe crash timeframe and notes it", () => {
    const r = generateRoadmap(goal({ targetDate: "2026-09-01" }), today); // 15kg in ~4 weeks = unsafe
    expect(r.note).toMatch(/capped it at a healthy rate/i);
    const last = r.milestones[r.milestones.length - 1]!;
    // safe pace pushes the real end date well past the requested one
    expect(Date.parse(last.targetDate!)).toBeGreaterThan(Date.parse("2026-10-01"));
  });
});
