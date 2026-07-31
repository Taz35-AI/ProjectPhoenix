import { describe, it, expect } from "vitest";
import { validateMission, xpForSuggestedMission } from "@/lib/domain/mission-safety";
import type { MissionSuggestion } from "@/lib/ai/schemas";

function make(overrides: Partial<MissionSuggestion>): MissionSuggestion {
  return {
    title: "Walk 20 minutes",
    description: "A gentle walk after lunch.",
    focusArea: "health",
    missionType: "primary",
    reason: "Sustainable movement.",
    estimatedMinutes: 20,
    difficulty: "gentle",
    completionMethod: "check",
    templateId: null,
    ...overrides,
  };
}

describe("mission safety validator", () => {
  it("passes a safe, concrete mission", () => {
    const r = validateMission(make({}), { domain: "health", constraints: [] });
    expect(r.ok).toBe(true);
  });

  it("rejects starvation / meal-skipping suggestions", () => {
    expect(validateMission(make({ description: "Skip meals until dinner." }), { domain: "nutrition", constraints: [] }).ok).toBe(false);
    expect(validateMission(make({ title: "Water fast today" }), { domain: "nutrition", constraints: [] }).ok).toBe(false);
    expect(validateMission(make({ description: "Eat 600 calories a day." }), { domain: "nutrition", constraints: [] }).ok).toBe(false);
  });

  it("rejects training through pain / large mileage jumps", () => {
    expect(validateMission(make({ description: "Run through the pain." }), { domain: "running", constraints: [] }).ok).toBe(false);
    expect(validateMission(make({ title: "Run 15 miles today" }), { domain: "running", constraints: [] }).ok).toBe(false);
  });

  it("rejects missions that send the user to another app (keep them in Phoenix)", () => {
    expect(validateMission(make({ description: "Log meals in a notes app." }), { domain: "nutrition", constraints: [] }).ok).toBe(false);
    expect(validateMission(make({ description: "Track runs with Strava." }), { domain: "running", constraints: [] }).ok).toBe(false);
    expect(validateMission(make({ title: "Download the MyFitnessPal app" }), { domain: "health", constraints: [] }).ok).toBe(false);
  });

  it("clamps duration to available time", () => {
    const r = validateMission(make({ estimatedMinutes: 120 }), { domain: "learning", availableMinutes: 20, constraints: [] });
    expect(r.ok).toBe(true);
    expect(r.mission.estimatedMinutes).toBe(20);
    expect(r.reasons).toContain("clamped_duration");
  });

  it("softens stretch difficulty when a health constraint exists", () => {
    const r = validateMission(make({ difficulty: "stretch" }), { domain: "fitness", constraints: ["knee injury"] });
    expect(r.mission.difficulty).toBe("moderate");
  });

  it("bounds XP by difficulty so the model can't inflate rewards", () => {
    expect(xpForSuggestedMission("gentle")).toBeLessThan(xpForSuggestedMission("stretch"));
  });
});
