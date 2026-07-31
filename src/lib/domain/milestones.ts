/**
 * Milestone engine — turns a goal into an EXACT, concrete roadmap.
 *
 * Numbers and dates are computed by the application, never invented by the AI.
 * For weight this means a documented, safe rate; for other numeric goals, even
 * increments; otherwise time-boxed phases. Everything here is pure + testable.
 */

export interface MilestoneSpec {
  title: string;
  description: string | null;
  targetValue: number | null;
  unit: string | null;
  /** YYYY-MM-DD, when we can compute a safe/known pace. */
  targetDate: string | null;
  sortOrder: number;
}

export interface RoadmapGoal {
  domain: string;
  displayTitle: string;
  rawInput: string;
  currentState: string | null;
  targetState: string | null;
  targetDate: string | null; // YYYY-MM-DD if the user gave one
}

export interface Roadmap {
  milestones: MilestoneSpec[];
  method: "weight_safe_rate" | "numeric_increments" | "time_phases";
  note: string | null;
}

// Safe, documented default for weight change. ~0.5–1% of body weight/week is a
// common guideline; we default to a sustainable 0.7 kg/week and cap at 1%/week.
const DEFAULT_WEIGHT_RATE_KG_PER_WEEK = 0.7;

export function generateRoadmap(goal: RoadmapGoal, today: Date): Roadmap {
  // Only plausible adult body weights — this drops a "lose 26 kg" delta so it
  // isn't mistaken for a (impossible) 26 kg target weight.
  const weights = extractKg(`${goal.rawInput} ${goal.currentState ?? ""} ${goal.targetState ?? ""}`).filter(
    (w) => w >= 35 && w <= 400,
  );
  const isWeightDomain = ["health", "fitness", "nutrition"].includes(goal.domain);

  // Weight loss: two plausible weights present and target < current.
  if (isWeightDomain && weights.length >= 2) {
    const current = Math.max(...weights);
    const target = Math.min(...weights);
    if (current - target >= 2) {
      return weightLossRoadmap(current, target, today, goal.targetDate);
    }
  }

  // Generic numeric goal with a single target number (e.g. "Save £10,000").
  const target = extractLeadingNumber(goal.targetState) ?? extractTargetFromRaw(goal.rawInput);
  if (target && target.value > 0) {
    return numericIncrementRoadmap(target.value, target.unit, goal.targetDate, today);
  }

  return timePhaseRoadmap(goal.displayTitle, today);
}

// --- Weight (deterministic, safe) -----------------------------------------
function weightLossRoadmap(currentKg: number, targetKg: number, today: Date, targetDate: string | null): Roadmap {
  const total = currentKg - targetKg;
  const safeMax = Math.max(DEFAULT_WEIGHT_RATE_KG_PER_WEEK, currentKg * 0.01); // ~1%/week ceiling

  // If the user gave a timeframe, pace to it — but never faster than safe.
  let rate = DEFAULT_WEIGHT_RATE_KG_PER_WEEK;
  let cappedForSafety = false;
  if (targetDate) {
    const weeksAvailable = Math.max(1, daysBetweenIso(today.toISOString().slice(0, 10), targetDate) / 7);
    const required = total / weeksAvailable;
    if (required > safeMax) {
      rate = safeMax;
      cappedForSafety = true;
    } else {
      rate = Math.max(0.1, required); // honour a gentler, longer timeframe
    }
  }

  const steps = Math.min(6, Math.max(3, Math.round(total / 5))); // ~5 kg per milestone, 3–6 total
  const milestones: MilestoneSpec[] = [];
  for (let i = 1; i <= steps; i++) {
    const lost = (total * i) / steps;
    const weight = round1(currentKg - lost);
    const weeks = Math.round(lost / rate);
    milestones.push({
      title: i === steps ? `Reach your goal: ${weight} kg` : `Reach ${weight} kg`,
      description: i === steps ? "Your target — reached gradually and sustainably." : `About ${round1(lost)} kg down from where you started.`,
      targetValue: weight,
      unit: "kg",
      targetDate: addDays(today, weeks * 7),
      sortOrder: i,
    });
  }

  const baseNote = `Dates assume ~${round1(rate)} kg/week. Estimates, not medical advice — a doctor or dietitian can tailor this to you.`;
  return {
    milestones,
    method: "weight_safe_rate",
    note: cappedForSafety
      ? `Your timeframe would need an unsafe pace, so we've capped it at a healthy rate — the final date is a little later than hoped. ${baseNote}`
      : baseNote,
  };
}

// --- Generic numeric goal --------------------------------------------------
function numericIncrementRoadmap(target: number, unit: string | null, targetDate: string | null, today: Date): Roadmap {
  const steps = 5;
  const milestones: MilestoneSpec[] = [];
  for (let i = 1; i <= steps; i++) {
    const value = round1((target * i) / steps);
    let date: string | null = null;
    if (targetDate) {
      const totalDays = daysBetweenIso(today.toISOString().slice(0, 10), targetDate);
      if (totalDays > 0) date = addDays(today, Math.round((totalDays * i) / steps));
    }
    milestones.push({
      title: i === steps ? `Reach ${fmt(value, unit)}` : `Hit ${fmt(value, unit)}`,
      description: i === steps ? "The full target." : `${Math.round((i / steps) * 100)}% of the way there.`,
      targetValue: value,
      unit,
      targetDate: date,
      sortOrder: i,
    });
  }
  return { milestones, method: "numeric_increments", note: targetDate ? null : "Add a target date and we'll pace these milestones for you." };
}

// --- Fallback: time-boxed phases ------------------------------------------
function timePhaseRoadmap(goalTitle: string, today: Date): Roadmap {
  const phases: { day: number; title: string; desc: string }[] = [
    { day: 14, title: "Establish the habit", desc: "Two weeks of just showing up — small, repeatable actions." },
    { day: 45, title: "Build momentum", desc: "The action starts to feel normal. Consistency over intensity." },
    { day: 90, title: "See real change", desc: "Ninety days of steady effort — meaningful, visible progress toward your goal." },
  ];
  return {
    milestones: phases.map((p, i) => ({
      title: p.title,
      description: p.desc,
      targetValue: null,
      unit: null,
      targetDate: addDays(today, p.day),
      sortOrder: i + 1,
    })),
    method: "time_phases",
    note: "This goal doesn't have exact numbers yet. Add a measurable target and we'll build a precise, dated path.",
  };
}

// --- parsing helpers -------------------------------------------------------
export function extractKg(text: string): number[] {
  const out: number[] = [];
  const re = /(\d{2,3}(?:\.\d)?)\s*(?:kg|kilos?|kilograms?)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.push(parseFloat(m[1]!));
  return out;
}

function extractLeadingNumber(text: string | null): { value: number; unit: string | null } | null {
  if (!text) return null;
  const m = text.match(/([£$€]?)\s*(\d[\d,]*(?:\.\d+)?)\s*([a-zA-Z%]+)?/);
  if (!m) return null;
  const value = parseFloat(m[2]!.replace(/,/g, ""));
  if (!isFinite(value)) return null;
  const unit = m[1] || m[3] || null;
  return { value, unit };
}

function extractTargetFromRaw(raw: string): { value: number; unit: string | null } | null {
  // "Save £10,000", "Read 24 books" — take the most prominent number.
  return extractLeadingNumber(raw);
}

// --- date/number utils -----------------------------------------------------
function addDays(from: Date, days: number): string {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function daysBetweenIso(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function fmt(value: number, unit: string | null): string {
  if (!unit) return `${value}`;
  if (["£", "$", "€"].includes(unit)) return `${unit}${value.toLocaleString()}`;
  return `${value} ${unit}`;
}
