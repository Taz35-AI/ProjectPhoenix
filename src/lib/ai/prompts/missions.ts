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
}

export function buildMissionsPrompt(ctx: MissionGenContext): string {
  return `You design TODAY's small missions for a grounded personal-transformation app.
Produce 1 to 3 missions that are CONCRETE, SPECIFIC, and genuinely doable today.

The user's goal: "${ctx.goalTitle}" (domain: ${ctx.domain})
Current state: ${ctx.currentState ?? "unknown"}
Target state: ${ctx.targetState ?? "unknown"}
Constraints (respect strictly): ${ctx.constraints.length ? ctx.constraints.join("; ") : "none stated"}
Time available today: about ${ctx.availableMinutes} minutes
Identity they're building: ${ctx.identityTraits.join(", ") || "unspecified"}
Avoid repeating these recent missions: ${ctx.recentMissionTitles.join("; ") || "none"}

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
