/**
 * Character attributes — owned entirely by application logic.
 *
 * Design guarantees:
 *  - A missed day NEVER reduces an attribute. Attributes only grow, on real
 *    positive actions, so a bad day can't "destroy progress".
 *  - Gains show diminishing returns near the cap, so numbers stay meaningful
 *    and can't be farmed to 100 in a week.
 *  - Every change is explainable (we log a reason with each delta).
 */

export const ATTRIBUTES = [
  "discipline",
  "health",
  "courage",
  "focus",
  "resilience",
  "knowledge",
  "stability",
  "connection",
] as const;

export type Attribute = (typeof ATTRIBUTES)[number];
export type AttributeDeltas = Partial<Record<Attribute, number>>;

export const ATTRIBUTE_LABELS: Record<Attribute, string> = {
  discipline: "Discipline",
  health: "Health",
  courage: "Courage",
  focus: "Focus",
  resilience: "Resilience",
  knowledge: "Knowledge",
  stability: "Stability",
  connection: "Connection",
};

type MissionType = "primary" | "maintenance" | "courage" | "recovery" | "reflection";

/** Base attribute growth for completing a mission, by domain + type. */
export function deltasForMissionCompletion(domain: string, missionType: string): AttributeDeltas {
  const d: AttributeDeltas = { discipline: 2, focus: 1 };

  switch (domain) {
    case "health":
    case "fitness":
    case "nutrition":
    case "running":
      add(d, "health", 2);
      break;
    case "learning":
      add(d, "knowledge", 2);
      break;
    case "career":
    case "business":
    case "finance":
      add(d, "knowledge", 1);
      add(d, "discipline", 1);
      break;
    case "confidence":
    case "social":
      add(d, "courage", 1);
      add(d, "connection", 1);
      break;
    case "relationships":
    case "family":
      add(d, "connection", 2);
      break;
    case "mental_wellbeing":
      add(d, "stability", 2);
      break;
  }

  switch (missionType as MissionType) {
    case "courage":
      add(d, "courage", 3);
      break;
    case "recovery":
      add(d, "resilience", 2);
      break;
    case "reflection":
      add(d, "stability", 1);
      break;
  }
  return d;
}

/** Partial completion still counts — at reduced weight. */
export function scaleDeltas(d: AttributeDeltas, factor: number): AttributeDeltas {
  const out: AttributeDeltas = {};
  for (const k of Object.keys(d) as Attribute[]) out[k] = round1((d[k] ?? 0) * factor);
  return out;
}

export function deltasForHonestReflection(): AttributeDeltas {
  return { resilience: 1, stability: 1 };
}

export function deltasForComeback(): AttributeDeltas {
  return { resilience: 3 };
}

/**
 * Applies a delta with diminishing returns near the 0..100 cap. At value 0 the
 * full delta lands; approaching 100 only a fraction does. Never decreases for a
 * positive delta.
 */
export function applyDelta(current: number, delta: number): number {
  if (delta <= 0) return clamp(current + delta);
  const headroomFactor = 1 - (current / 100) * 0.7; // 1.0 at 0 → 0.3 at 100
  return clamp(current + delta * headroomFactor);
}

function add(d: AttributeDeltas, k: Attribute, n: number) {
  d[k] = round1((d[k] ?? 0) + n);
}
function clamp(n: number): number {
  return Math.max(0, Math.min(100, round1(n)));
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
