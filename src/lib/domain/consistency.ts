/**
 * Consistency, not fragile streaks. We never surface a "you lost your streak"
 * moment. Missing a day lowers a rolling number slightly; RETURNING is framed
 * as protecting momentum and is itself rewardable.
 *
 * All functions are pure and operate on UTC calendar days (YYYY-MM-DD).
 */

export interface ConsistencySnapshot {
  /** Fraction of the last 7 days with at least one completed action (0..1). */
  sevenDay: number;
  /** Fraction of the last 30 days with at least one completed action (0..1). */
  thirtyDay: number;
  /** Weighted recent momentum, recent days count more (0..1). */
  momentum: number;
  /** True if the user acted today after a gap of >= 2 days. */
  returnedAfterGap: boolean;
  /** Longest gap in days within the window (for gentle, honest messaging). */
  longestGapDays: number;
}

/** activeDays: set of UTC 'YYYY-MM-DD' strings the user completed >=1 action. */
export function computeConsistency(activeDays: Set<string>, today: Date): ConsistencySnapshot {
  const last = (n: number) => rangeDays(today, n);

  const seven = last(7);
  const thirty = last(30);

  const sevenDay = fraction(seven, activeDays);
  const thirtyDay = fraction(thirty, activeDays);

  // Momentum: linear recency weights over 14 days.
  const window = last(14);
  let weighted = 0;
  let weightSum = 0;
  window.forEach((day, i) => {
    const w = window.length - i; // most recent day highest weight
    weightSum += w;
    if (activeDays.has(day)) weighted += w;
  });
  const momentum = weightSum === 0 ? 0 : weighted / weightSum;

  const todayKey = toKey(today);
  const returnedAfterGap = activeDays.has(todayKey) && gapBefore(today, activeDays) >= 2;
  const longestGapDays = longestGap(thirty, activeDays);

  return {
    sevenDay: round2(sevenDay),
    thirtyDay: round2(thirtyDay),
    momentum: round2(momentum),
    returnedAfterGap,
    longestGapDays,
  };
}

/** Non-shaming status line derived purely from the snapshot. */
export function consistencyMessage(s: ConsistencySnapshot): string {
  if (s.returnedAfterGap) {
    return "You missed some days, but returning today protects your momentum.";
  }
  if (s.momentum >= 0.7) return "Strong momentum — you've been showing up consistently.";
  if (s.momentum >= 0.4) return "Steady progress. Consistency is building.";
  if (s.momentum > 0) return "You're moving. One small action keeps the path warm.";
  return "Your next step is ready whenever you are.";
}

// --- helpers -------------------------------------------------------------

function toKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function rangeDays(today: Date, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(toKey(d));
  }
  return out; // oldest -> newest
}
function fraction(days: string[], active: Set<string>): number {
  const hit = days.filter((d) => active.has(d)).length;
  return days.length === 0 ? 0 : hit / days.length;
}
/** Days since the previous active day, or -1 if there is NO prior history. */
function gapBefore(today: Date, active: Set<string>): number {
  let gap = 0;
  for (let i = 1; i <= 60; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    if (active.has(toKey(d))) return gap;
    gap++;
  }
  return -1; // no earlier check-in — a new user, not a comeback
}
function longestGap(days: string[], active: Set<string>): number {
  let longest = 0;
  let current = 0;
  for (const d of days) {
    if (active.has(d)) {
      current = 0;
    } else {
      current++;
      if (current > longest) longest = current;
    }
  }
  return longest;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
