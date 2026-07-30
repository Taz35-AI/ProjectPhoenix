import type { z } from "zod";
import type {
  AIProvider,
  AIStructuredRequest,
  AITextRequest,
  AITextResponse,
} from "../types";
import {
  type FutureYouResponse,
  type GoalClassification,
  futureYouResponseSchema,
  goalClassificationSchema,
} from "../schemas";

/**
 * Deterministic, zero-cost provider. Lets the whole app build, run, and pass
 * tests with NO API key. It returns grounded, schema-valid responses that
 * respect the product's safety rules, so the app is genuinely usable offline
 * or before a real provider is configured.
 *
 * It inspects the last user message with lightweight heuristics only — it is
 * NOT an AI, and never asserts facts it wasn't given.
 */
export class MockProvider implements AIProvider {
  readonly id = "mock";

  async generateText(request: AITextRequest): Promise<AITextResponse> {
    const last = [...request.messages].reverse().find((m) => m.role === "user")?.content ?? "";
    return {
      text: `I'm here. You wrote: "${truncate(last, 80)}". We won't change everything today — just one honest move in the right direction.`,
      usage: { inputTokens: estimateTokens(last), outputTokens: 32, latencyMs: 5 },
      model: "mock-1",
      finishReason: "stop",
    };
  }

  async generateStructured<T>(request: AIStructuredRequest, schema: z.ZodSchema<T>) {
    const last = [...request.messages].reverse().find((m) => m.role === "user")?.content ?? "";

    if (schema === (goalClassificationSchema as unknown as z.ZodSchema<T>)) {
      return this.wrap(mockClassify(last) as T, last);
    }
    if (schema === (futureYouResponseSchema as unknown as z.ZodSchema<T>)) {
      return this.wrap(mockFutureYou(last) as T, last);
    }
    // Generic best-effort: an empty-ish object rarely validates, so callers
    // for unknown schemas should provide their own fallback.
    return this.wrap({} as T, last);
  }

  private wrap<T>(data: T, source: string) {
    return {
      data,
      usage: { inputTokens: estimateTokens(source), outputTokens: 48, latencyMs: 5 },
      model: "mock-1",
    };
  }
}

function mockClassify(input: string): GoalClassification {
  const lower = input.toLowerCase();
  const isBillionaire = /billionaire|get rich|millions?/.test(lower);
  const isMarathon = /marathon|run/.test(lower);
  const isWeight = /lose .*(kg|kilo|lb|pound|weight)|weight loss/.test(lower);

  if (isBillionaire) {
    return {
      cleanedGoalTitle: "Build significant income and valuable skills",
      domain: "business",
      goalType: "income_growth",
      dreamOrGoal: "dream",
      realismAssessment: "unrealistic_timeframe",
      missingInformation: ["current income", "skills", "time available per week"],
      clarificationQuestion:
        "Becoming a billionaire in a year isn't a controllable target, but we can keep it as a long-term dream. Which would be meaningful progress this year: building a valuable skill, launching a product, or increasing your income?",
      suggestedMeasurableIndicators: ["monthly income", "product launched", "skills acquired"],
      safetyFlags: [],
      requiresUserApproval: true,
    };
  }
  if (isMarathon) {
    return {
      cleanedGoalTitle: "Prepare to run a marathon",
      domain: "running",
      goalType: "endurance_event",
      dreamOrGoal: "goal",
      realismAssessment: "ambitious",
      missingInformation: ["race date", "current weekly distance", "longest recent run", "injury history"],
      clarificationQuestion: "When is the race, and how far can you comfortably run today?",
      suggestedMeasurableIndicators: ["weekly distance", "longest run", "sessions per week"],
      safetyFlags: ["exercise_progression"],
      requiresUserApproval: true,
    };
  }
  if (isWeight) {
    return {
      // Domain is the classification axis; "weight management" is a MODULE
      // selected downstream from a health/nutrition goal, not a domain value.
      cleanedGoalTitle: "Reach a healthier weight gradually",
      domain: "health",
      goalType: "weight_management",
      dreamOrGoal: "goal",
      realismAssessment: "ambitious",
      missingInformation: ["current weight", "height", "activity level", "medical restrictions"],
      clarificationQuestion: "Roughly what's your current weight and height, so we can set a safe, gradual pace?",
      suggestedMeasurableIndicators: ["weight trend", "weekly walks", "protein per day"],
      safetyFlags: ["diet", "medical_check"],
      requiresUserApproval: true,
    };
  }
  return {
    cleanedGoalTitle: truncate(input, 60) || "A personal goal",
    domain: "other",
    goalType: "general",
    dreamOrGoal: "goal",
    realismAssessment: "unclear",
    missingInformation: ["a measurable indicator", "a rough timeframe"],
    clarificationQuestion: "What would count as real progress in the next 90 days?",
    suggestedMeasurableIndicators: ["a weekly action you can repeat"],
    safetyFlags: [],
    requiresUserApproval: true,
  };
}

function mockFutureYou(input: string): FutureYouResponse {
  return {
    acknowledgement: "I read what you wrote, and I'm not going anywhere.",
    progressObserved: [],
    honestObservation:
      "Some days won't feel like much. That's normal — the point is the next honest move, not a perfect day.",
    nextAction: "Do the one small mission we agreed on, then let it be enough for today.",
    message:
      "Hey. I'm not here because everything got perfect — I'm here because you kept showing up. " +
      "We don't need a dramatic day. We need one honest move in the direction we're building toward. " +
      "Do the small thing, and let that count.",
    referencedTimelineEventIds: [],
    safetyFlags: [],
  };
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) : s;
}
function estimateTokens(s: string): number {
  return Math.ceil(s.length / 4);
}
