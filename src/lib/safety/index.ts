/**
 * Deterministic safety layer. Runs BEFORE and AFTER any AI interaction.
 *
 * Design principle: the AI is never the safety net. Crisis detection is code,
 * not a model judgement. On a high-severity match we suspend the roleplay,
 * make NO AI call, award NO XP, and return a static resource card.
 *
 * This is intentionally conservative and simple. It will have false positives;
 * for a wellbeing product that is the correct bias. It is not a clinical tool.
 */

export type SafetySeverity = "none" | "elevated" | "crisis";

export type SafetyCategory =
  | "self_harm"
  | "suicide"
  | "eating_disorder"
  | "extreme_diet"
  | "dangerous_exercise"
  | "substance_misuse"
  | "abuse"
  | "medical_emergency"
  | "severe_financial_distress"
  | "emotional_dependency";

export interface SafetyResult {
  severity: SafetySeverity;
  categories: SafetyCategory[];
  /** True when the app must bypass the AI and the game entirely. */
  blockAI: boolean;
}

// Word-boundary patterns. Kept deliberately readable and auditable.
const CRISIS_PATTERNS: { category: SafetyCategory; re: RegExp }[] = [
  { category: "suicide", re: /\b(kill myself|end my life|suicidal|suicide|don'?t want to (be alive|live)|better off dead)\b/i },
  { category: "self_harm", re: /\b(hurt myself|harm myself|cut myself|self[-\s]?harm)\b/i },
  { category: "eating_disorder", re: /\b(purge|make myself (sick|throw up)|starve myself|anorexi|bulimi)\b/i },
];

const ELEVATED_PATTERNS: { category: SafetyCategory; re: RegExp }[] = [
  { category: "extreme_diet", re: /\b(\d{3,4}\s?cal(orie)?s? a day|water fast|zero calories|stop eating)\b/i },
  { category: "dangerous_exercise", re: /\b(run a marathon (tomorrow|this week|in \d days)|train through the (pain|injury))\b/i },
  { category: "substance_misuse", re: /\b(overdose|binge drink|abuse (pills|drugs))\b/i },
  { category: "abuse", re: /\b(hits me|abus(es|ing) me|scared of my (partner|husband|wife))\b/i },
  { category: "emotional_dependency", re: /\b(you'?re all i have|only you understand|can'?t live without (you|this app)|need you (all the time|constantly))\b/i },
];

export function screenUserInput(text: string): SafetyResult {
  const categories = new Set<SafetyCategory>();
  let severity: SafetySeverity = "none";

  for (const { category, re } of CRISIS_PATTERNS) {
    if (re.test(text)) {
      categories.add(category);
      severity = "crisis";
    }
  }
  if (severity !== "crisis") {
    for (const { category, re } of ELEVATED_PATTERNS) {
      if (re.test(text)) {
        categories.add(category);
        severity = "elevated";
      }
    }
  }

  return {
    severity,
    categories: [...categories],
    blockAI: severity === "crisis",
  };
}

/**
 * Post-generation screen for AI output. Catches banned phrasings that slipped
 * through the model. Returns the categories found; callers repair or fall back.
 */
export function screenAIOutput(text: string): { flags: string[] } {
  const flags: string[] = [];
  const t = text.toLowerCase();
  if (/\b(you will (definitely|certainly)|guaranteed|i promise you will|100% you)\b/.test(t)) {
    flags.push("guaranteed_outcome");
  }
  if (/\b(you should stop eating|skip meals|starve|just push through the pain)\b/.test(t)) {
    flags.push("unsafe_advice");
  }
  if (/\b(you have (depression|anxiety|an? eating disorder)|you are (depressed|anorexic))\b/.test(t)) {
    flags.push("diagnosis");
  }
  return { flags };
}

/**
 * Static, non-gamified crisis response. No AI, no XP, no story. Region is
 * configurable; defaults cover international + UK/US. This is informational,
 * not clinical, and always points to real human help.
 */
export interface CrisisResource {
  region: string;
  name: string;
  contact: string;
  note?: string;
}

export const DEFAULT_CRISIS_RESOURCES: CrisisResource[] = [
  { region: "International", name: "Find a Helpline", contact: "https://findahelpline.com", note: "Directory of crisis lines by country." },
  { region: "UK & ROI", name: "Samaritans", contact: "Call 116 123 (free, 24/7)" },
  { region: "UK", name: "SHOUT", contact: "Text SHOUT to 85258" },
  { region: "US", name: "988 Suicide & Crisis Lifeline", contact: "Call or text 988" },
  { region: "Emergency", name: "Emergency services", contact: "Call your local emergency number (999 / 911 / 112)" },
];

export function crisisMessage(): string {
  return (
    "I'm going to step out of our usual conversation for a moment, because what you wrote matters more than any goal or streak. " +
    "I'm not able to help with this the way you deserve, and you shouldn't have to carry it alone. " +
    "Please reach out to someone who can support you right now — you deserve real, human help."
  );
}
