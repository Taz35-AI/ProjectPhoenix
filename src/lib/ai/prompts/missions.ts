export const MISSIONS_PROMPT_VERSION = "missions.v1";

export interface MissionGenContext {
  goalTitle: string;
  domain: string;
  currentState: string | null;
  targetState: string | null;
  constraints: string[];
  availableMinutes: number;
  recentMissionTitles: string[];
  identityTraits: string[];
  /** From onboarding "what feels hardest" — the plan must adapt to these. */
  obstacles: string[];
  /** The current milestone we're working toward, if any. */
  currentMilestone: string | null;
  /** Max missions to return (obstacles like overwhelm reduce this). */
  maxMissions: number;
}

/** Turns obstacle codes into concrete guidance for the mission generator. */
export function obstacleGuidance(obstacles: string[]): string[] {
  const g: string[] = [];
  const has = (k: string) => obstacles.includes(k);
  if (has("procrastinate") || has("dont_finish"))
    g.push("They procrastinate — make the first mission absurdly small (a 2-minute version they can't say no to).");
  if (has("overwhelmed") || has("exhausted"))
    g.push("They feel overwhelmed/exhausted — give as FEW missions as possible today, each tiny and low-effort.");
  if (has("low_confidence"))
    g.push("Low confidence — include one small, guaranteed-achievable win to build belief.");
  if (has("inconsistent") || has("lost_discipline"))
    g.push("They struggle with consistency — favour a small daily anchor that's easy to repeat every day.");
  if (has("where_to_begin")) g.push("They don't know where to begin — be very concrete about the exact first action.");
  return g;
}

export function buildMissionsPrompt(ctx: MissionGenContext): string {
  const guidance = obstacleGuidance(ctx.obstacles);
  return `You design TODAY's small missions for a grounded personal-transformation app.
Produce between 1 and ${ctx.maxMissions} missions that are CONCRETE, SPECIFIC, and genuinely doable today.

The user's goal: "${ctx.goalTitle}" (domain: ${ctx.domain})
Current state: ${ctx.currentState ?? "unknown"}
Target state: ${ctx.targetState ?? "unknown"}
Current milestone we're working toward: ${ctx.currentMilestone ?? "not set"}
Constraints (respect strictly): ${ctx.constraints.length ? ctx.constraints.join("; ") : "none stated"}
Time available today: about ${ctx.availableMinutes} minutes
Identity they're building: ${ctx.identityTraits.join(", ") || "unspecified"}
Avoid repeating these recent missions: ${ctx.recentMissionTitles.join("; ") || "none"}

Adapt to what they find hardest:
${guidance.length ? guidance.map((g) => `- ${g}`).join("\n") : "- (no specific obstacles noted)"}

Rules:
- Be specific and measurable. "Walk 20 minutes after lunch" — not "move more".
  "Note what you ate today" — not "be mindful of food".
- NEVER tell the user to use, open, download, or switch to another app, website,
  or external tool (no "notes app", "use MyFitnessPal", "set a phone reminder").
  All logging, notes, and tracking happen INSIDE this app — phrase missions so
  they're done and recorded here (e.g. completion method "note" or "quantity").
- Small and achievable TODAY. One clear action per mission.
- The FIRST mission is the primary one; others are optional/supporting.
- SAFETY: never suggest starvation, skipping meals, fasting, detoxes, extreme
  calorie targets, large mileage jumps, training through pain/injury, or
  anything a doctor/dietitian should decide. Prefer gradual, sustainable steps
  (walking, protein/fibre awareness, hydration, sleep, short focused practice).
- No guarantees, no medical prescriptions.
- estimatedMinutes must fit the available time.

Respond ONLY with JSON in the required shape.`;
}
