/**
 * Story chapters — the emotional spine of the journey. Progression is
 * deterministic and gentle: chapters advance on meaningful cumulative progress,
 * never on time-in-app, and never regress. Only the first four are "live" in
 * the prototype; later chapters exist as narrative but aren't yet reachable.
 */

export interface ChapterDef {
  id: number;
  slug: string;
  title: string;
  /** Cumulative completed missions required to ENTER this chapter. */
  missionsToEnter: number;
  entryMessage: string;
}

export const CHAPTERS: ChapterDef[] = [
  {
    id: 1,
    slug: "awakening",
    title: "The Awakening",
    missionsToEnter: 0,
    entryMessage: "You noticed something has to change. That noticing is where every journey begins.",
  },
  {
    id: 2,
    slug: "decision",
    title: "The Decision",
    missionsToEnter: 1,
    entryMessage: "You didn't just want it — you moved. That first honest action is the decision.",
  },
  {
    id: 3,
    slug: "first-steps",
    title: "The First Steps",
    missionsToEnter: 4,
    entryMessage: "No leaps. Just small, honest moves repeated until they start to hold weight.",
  },
  {
    id: 4,
    slug: "resistance",
    title: "Resistance",
    missionsToEnter: 10,
    entryMessage: "Momentum meets friction now. This chapter is about returning, not being perfect.",
  },
];

export interface ChapterState {
  current: ChapterDef;
  /** Missions still needed to reach the next chapter, or null at the last live one. */
  missionsToNext: number | null;
  next: ChapterDef | null;
}

/** Highest chapter whose entry threshold is met by completed-mission count. */
export function chapterForProgress(completedMissions: number): ChapterState {
  let current = CHAPTERS[0]!;
  for (const c of CHAPTERS) {
    if (completedMissions >= c.missionsToEnter) current = c;
  }
  const next = CHAPTERS.find((c) => c.id === current.id + 1) ?? null;
  const missionsToNext = next ? Math.max(0, next.missionsToEnter - completedMissions) : null;
  return { current, missionsToNext, next };
}

/**
 * Overall journey progress 0..1, used to brighten the visual path. Blends
 * chapter position with progress toward the next chapter so the horizon warms
 * gradually rather than in steps.
 */
export function journeyProgress(completedMissions: number): number {
  const state = chapterForProgress(completedMissions);
  const span = CHAPTERS.length;
  const base = (state.current.id - 1) / span;
  if (!state.next || state.missionsToNext === null) return Math.min(1, base + 1 / span);
  const within = state.next.missionsToEnter - state.current.missionsToEnter;
  const done = within > 0 ? (within - state.missionsToNext) / within : 0;
  return Math.min(1, base + done / span);
}
