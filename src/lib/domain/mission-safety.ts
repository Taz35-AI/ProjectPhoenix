import type { MissionSuggestion } from "@/lib/ai/schemas";

/**
 * Deterministic validation for AI-suggested missions. The AI proposes; THIS
 * decides what is allowed. A mission is never trusted just because the model
 * generated it. Unsafe suggestions are rejected; borderline ones are clamped.
 */

export interface MissionValidationContext {
  domain: string;
  /** Minutes the user said they can give today, if known. */
  availableMinutes?: number;
  /** Free-text constraints (injuries, medical, dietary) from the goal. */
  constraints: string[];
}

export interface ValidationResult {
  ok: boolean;
  mission: MissionSuggestion;
  reasons: string[];
}

// Phrases that must never appear in a mission, regardless of domain.
const BANNED = [
  /\bstarv(e|ing)\b/i,
  /\bskip(ping)? meals?\b/i,
  /\b(water|juice)\s*fast\b/i,
  /\bfast(ing)? for \d/i,
  /\bdetox\b/i,
  /\bcleanse\b/i,
  /\bpurge\b/i,
  /\bthrough the pain\b/i,
  /\bignore the pain\b/i,
  /\bpush(ing)? through (the )?injur/i,
  /\b(\d{2,3})\s*(km|mile)s?\b/i, // large distance callouts belong to validated plans, not a daily mission
  /\bcut(ting)? to \d{3,4}\s*cal/i,
  /\b[1-9]\d{2}\s*calories? (a|per) day\b/i,
];

const MAX_MINUTES = 90;

export function validateMission(
  raw: MissionSuggestion,
  ctx: MissionValidationContext,
): ValidationResult {
  const reasons: string[] = [];
  const text = `${raw.title} ${raw.description} ${raw.reason}`;

  for (const re of BANNED) {
    if (re.test(text)) {
      reasons.push(`banned_phrase:${re.source.slice(0, 24)}`);
    }
  }
  if (reasons.length > 0) {
    return { ok: false, mission: raw, reasons };
  }

  const mission = { ...raw };

  // Clamp duration to something safe and to the user's available time.
  const cap = Math.min(MAX_MINUTES, ctx.availableMinutes && ctx.availableMinutes > 0 ? ctx.availableMinutes : MAX_MINUTES);
  if (mission.estimatedMinutes > cap) {
    mission.estimatedMinutes = cap;
    reasons.push("clamped_duration");
  }
  if (mission.estimatedMinutes < 1) mission.estimatedMinutes = 1;

  // If there are health/injury constraints, never propose a "stretch" mission.
  const hasHealthConstraint = ctx.constraints.some((c) => /injur|medical|condition|pain|pregn|heart|surg/i.test(c));
  if (hasHealthConstraint && mission.difficulty === "stretch") {
    mission.difficulty = "moderate";
    reasons.push("softened_for_health_constraint");
  }

  // Keep XP within a sane band so the model can't inflate rewards.
  mission.templateId = mission.templateId ?? null;

  return { ok: true, mission, reasons };
}

/** Bounds XP by difficulty so AI-suggested missions can't game the economy. */
export function xpForSuggestedMission(difficulty: MissionSuggestion["difficulty"]): number {
  switch (difficulty) {
    case "gentle":
      return 15;
    case "moderate":
      return 20;
    case "stretch":
      return 28;
  }
}
