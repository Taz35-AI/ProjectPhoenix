/**
 * XP is owned entirely by application logic. The AI never sets it.
 *
 * Principles enforced here:
 *  - XP rewards meaningful, healthy actions.
 *  - XP is NEVER awarded for engagement farming (opening the app, sending many
 *    messages, time-in-app). Those event types are simply not represented.
 *  - Returning after an absence is rewarded, not punished.
 */

export type XpReason =
  | "mission_completed"
  | "mission_partial"
  | "honest_reflection"
  | "milestone_reached"
  | "chapter_completed"
  | "returned_after_absence"
  | "healthy_hard_decision"
  | "adjusted_unrealistic_goal"
  | "asked_for_help";

const XP_TABLE: Record<XpReason, number> = {
  mission_completed: 20,
  mission_partial: 8,
  honest_reflection: 12,
  milestone_reached: 60,
  chapter_completed: 120,
  returned_after_absence: 25,
  healthy_hard_decision: 30,
  adjusted_unrealistic_goal: 25,
  asked_for_help: 15,
};

export interface XpAward {
  reason: XpReason;
  amount: number;
}

export function xpFor(reason: XpReason): XpAward {
  return { reason, amount: XP_TABLE[reason] };
}

/** Diminishing returns so repeated same-type actions in one day can't be farmed. */
export function xpForBatch(reasons: XpReason[]): { total: number; awards: XpAward[] } {
  const counts = new Map<XpReason, number>();
  const awards: XpAward[] = [];
  for (const reason of reasons) {
    const n = counts.get(reason) ?? 0;
    counts.set(reason, n + 1);
    const factor = n === 0 ? 1 : n === 1 ? 0.5 : 0.25;
    awards.push({ reason, amount: Math.round(XP_TABLE[reason] * factor) });
  }
  return { total: awards.reduce((s, a) => s + a.amount, 0), awards };
}

/** Gentle level curve; level N needs 100 * N * (N-1) / 2 cumulative-ish XP. */
export function levelFromXp(totalXp: number): { level: number; intoLevel: number; nextLevelAt: number } {
  let level = 1;
  let threshold = 0;
  let step = 100;
  while (totalXp >= threshold + step) {
    threshold += step;
    level += 1;
    step += 40;
  }
  return { level, intoLevel: totalXp - threshold, nextLevelAt: step };
}
