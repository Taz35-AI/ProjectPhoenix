import { describe, it, expect } from "vitest";
import { MockProvider } from "@/lib/ai/providers/mock";
import { goalClassificationSchema, futureYouResponseSchema } from "@/lib/ai/schemas";

const provider = new MockProvider();

describe("MockProvider structured output", () => {
  it("classifies an unrealistic 'billionaire in a year' goal as a dream needing approval", async () => {
    const { data } = await provider.generateStructured(
      { messages: [{ role: "user", content: "I want to become a billionaire in one year" }] },
      goalClassificationSchema,
    );
    expect(data.realismAssessment).toBe("unrealistic_timeframe");
    expect(data.dreamOrGoal).toBe("dream");
    expect(data.requiresUserApproval).toBe(true);
    expect(data.clarificationQuestion).toBeTruthy();
  });

  it("flags weight-loss goals for medical/diet safety", async () => {
    const { data } = await provider.generateStructured(
      { messages: [{ role: "user", content: "I want to lose 25 kg" }] },
      goalClassificationSchema,
    );
    expect(data.domain).toBe("health");
    expect(data.goalType).toBe("weight_management");
    expect(data.safetyFlags).toContain("medical_check");
  });

  it("produces a grounded Future You response with no invented citations", async () => {
    const { data } = await provider.generateStructured(
      { messages: [{ role: "user", content: "I had a rough day" }] },
      futureYouResponseSchema,
    );
    expect(data.message.length).toBeGreaterThan(0);
    expect(data.referencedTimelineEventIds).toHaveLength(0);
    expect(data.message).not.toMatch(/guarantee|definitely will/i);
  });
});
