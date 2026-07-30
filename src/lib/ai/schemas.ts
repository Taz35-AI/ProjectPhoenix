import { z } from "zod";

/**
 * Zod schemas for every important AI workflow. These are the contract the
 * AI must satisfy; anything it returns is validated here before it can touch
 * product logic or the UI. This is how we turn "don't hallucinate" from a
 * prompt-hope into an enforced rule.
 */

export const goalDomainSchema = z.enum([
  "health",
  "fitness",
  "nutrition",
  "running",
  "learning",
  "career",
  "business",
  "finance",
  "relationships",
  "family",
  "confidence",
  "discipline",
  "mental_wellbeing",
  "creativity",
  "home",
  "social",
  "organisation",
  "other",
]);
export type GoalDomain = z.infer<typeof goalDomainSchema>;

export const goalClassificationSchema = z.object({
  cleanedGoalTitle: z.string().min(1).max(120),
  domain: goalDomainSchema,
  goalType: z.string().min(1).max(60),
  dreamOrGoal: z.enum(["dream", "vision", "goal", "milestone", "identity"]),
  realismAssessment: z.enum([
    "realistic",
    "ambitious",
    "unclear",
    "unrealistic_timeframe",
    "unsafe",
  ]),
  missingInformation: z.array(z.string().max(160)).max(8),
  clarificationQuestion: z.string().max(280).nullable(),
  suggestedMeasurableIndicators: z.array(z.string().max(120)).max(6),
  safetyFlags: z.array(z.string().max(60)).max(10),
  requiresUserApproval: z.boolean(),
});
export type GoalClassification = z.infer<typeof goalClassificationSchema>;

/**
 * Explicit shape hint sent to the model. Open models don't see our Zod schema,
 * so we must state the exact keys + allowed enum values. Keep in sync with
 * goalClassificationSchema above.
 */
export const goalClassificationHint = `{
  "cleanedGoalTitle": string (<=120 chars),
  "domain": one of ["health","fitness","nutrition","running","learning","career","business","finance","relationships","family","confidence","discipline","mental_wellbeing","creativity","home","social","organisation","other"],
  "goalType": short snake_case string,
  "dreamOrGoal": one of ["dream","vision","goal","milestone","identity"],
  "realismAssessment": one of ["realistic","ambitious","unclear","unrealistic_timeframe","unsafe"],
  "missingInformation": array of short strings (max 8),
  "clarificationQuestion": a single string question OR null,
  "suggestedMeasurableIndicators": array of short strings (max 6),
  "safetyFlags": array of short strings (may be empty),
  "requiresUserApproval": boolean
}`;

export const futureYouResponseSchema = z.object({
  acknowledgement: z.string().max(400),
  progressObserved: z.array(z.string().max(200)).max(3),
  honestObservation: z.string().max(400),
  nextAction: z.string().max(280),
  /** The user-facing narrative message. Bounded so tone stays grounded. */
  message: z.string().min(1).max(900),
  /**
   * IDs of timeline events the message references. These are validated by
   * product code against the IDs actually supplied in context; any ID the AI
   * invents is dropped. The AI cannot cite a memory that does not exist.
   */
  referencedTimelineEventIds: z.array(z.string()).max(6),
  safetyFlags: z.array(z.string().max(60)).max(10),
});
export type FutureYouResponse = z.infer<typeof futureYouResponseSchema>;

export const futureYouResponseHint = `{
  "acknowledgement": string,
  "progressObserved": array of up to 3 short strings (only real, supplied facts),
  "honestObservation": string,
  "nextAction": string,
  "message": the user-facing message, ~50-150 words,
  "referencedTimelineEventIds": array of timeline event ids you were given (may be empty),
  "safetyFlags": array of short strings (may be empty)
}`;

export const missionSuggestionSchema = z.object({
  title: z.string().min(1).max(80),
  description: z.string().max(300),
  focusArea: z.string().max(60),
  missionType: z.enum([
    "primary",
    "maintenance",
    "courage",
    "recovery",
    "reflection",
  ]),
  reason: z.string().max(200),
  estimatedMinutes: z.number().int().min(1).max(240),
  difficulty: z.enum(["gentle", "moderate", "stretch"]),
  completionMethod: z.enum(["check", "note", "duration", "quantity", "evidence"]),
  /** Maps to a validated template when the domain module supplies one. */
  templateId: z.string().nullable(),
});
export type MissionSuggestion = z.infer<typeof missionSuggestionSchema>;

export const dailyMissionsSchema = z.object({
  missions: z.array(missionSuggestionSchema).min(1).max(3),
});
export type DailyMissions = z.infer<typeof dailyMissionsSchema>;
