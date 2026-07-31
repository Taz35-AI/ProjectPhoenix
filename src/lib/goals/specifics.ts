/**
 * Structured "specifics" for a goal — the anti-free-text layer.
 *
 * Instead of parsing what a user typed, we ask a few precise questions (numbers,
 * choices, dates) tailored to the goal's domain, and turn the answers into
 * concrete goal fields that deterministically drive the roadmap + missions.
 */

export type SpecFieldType = "number" | "choice" | "date" | "text";

export interface SpecField {
  key: string;
  label: string;
  type: SpecFieldType;
  unit?: string;
  options?: { value: string; label: string }[];
  placeholder?: string;
  optional?: boolean;
  min?: number;
  max?: number;
}

const TIMEFRAME_OPTIONS = [
  { value: "3m", label: "About 3 months" },
  { value: "6m", label: "About 6 months" },
  { value: "12m", label: "About a year" },
  { value: "none", label: "No fixed deadline" },
];

export function fieldsForDomain(domain: string): SpecField[] {
  switch (domain) {
    case "health":
    case "nutrition":
    case "fitness":
      return [
        { key: "currentWeight", label: "Your current weight", type: "number", unit: "kg", placeholder: "e.g. 95", min: 30, max: 400 },
        { key: "targetWeight", label: "Your target weight", type: "number", unit: "kg", placeholder: "e.g. 80", min: 30, max: 400 },
        { key: "timeframe", label: "Roughly how long?", type: "choice", options: TIMEFRAME_OPTIONS },
      ];
    case "finance":
      return [
        { key: "currentAmount", label: "Where you are now (optional)", type: "number", unit: "£", placeholder: "e.g. 500", optional: true, min: 0 },
        { key: "targetAmount", label: "Your target amount", type: "number", unit: "£", placeholder: "e.g. 5000", min: 0 },
        { key: "timeframe", label: "Roughly how long?", type: "choice", options: TIMEFRAME_OPTIONS },
      ];
    case "running":
      return [
        { key: "longestRunKm", label: "Longest run you can do today", type: "number", unit: "km", placeholder: "e.g. 3", min: 0, max: 100 },
        { key: "daysPerWeek", label: "Days a week you can train", type: "choice", options: [2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} days` })) },
        { key: "eventDate", label: "Race / event date (optional)", type: "date", optional: true },
      ];
    case "learning":
      return [
        { key: "weeklyHours", label: "Hours a week you can commit", type: "number", unit: "hrs", placeholder: "e.g. 5", min: 0, max: 80 },
        { key: "targetDate", label: "Target date (optional)", type: "date", optional: true },
      ];
    default:
      return [
        { key: "targetValue", label: "A number you're aiming for (optional)", type: "number", optional: true, placeholder: "e.g. 24" },
        { key: "unit", label: "Of what? (optional)", type: "text", optional: true, placeholder: "e.g. books, sessions, £" },
        { key: "timeframe", label: "Roughly how long?", type: "choice", options: TIMEFRAME_OPTIONS },
      ];
  }
}

export interface GoalSpecificsUpdate {
  currentState: string | null;
  targetState: string | null;
  targetDate: string | null;
  metric: { label: string; unit: string | null; baseline: number | null; target: number | null } | null;
}

export function buildGoalUpdate(domain: string, v: Record<string, string>, today: Date): GoalSpecificsUpdate {
  const num = (k: string) => {
    const n = parseFloat(v[k] ?? "");
    return isFinite(n) ? n : null;
  };
  const date = (k: string) => (v[k] && /^\d{4}-\d{2}-\d{2}$/.test(v[k]!) ? v[k]! : null);
  const tf = fromTimeframe(v["timeframe"], today);

  switch (domain) {
    case "health":
    case "nutrition":
    case "fitness": {
      const cw = num("currentWeight");
      const tw = num("targetWeight");
      return {
        currentState: cw ? `${cw} kg` : null,
        targetState: tw ? `${tw} kg` : null,
        targetDate: tf,
        metric: cw || tw ? { label: "Weight", unit: "kg", baseline: cw, target: tw } : null,
      };
    }
    case "finance": {
      const ca = num("currentAmount");
      const ta = num("targetAmount");
      return {
        currentState: ca != null ? `£${ca}` : null,
        targetState: ta != null ? `£${ta}` : null,
        targetDate: tf,
        metric: ta != null ? { label: "Savings", unit: "£", baseline: ca ?? 0, target: ta } : null,
      };
    }
    case "running": {
      const lr = num("longestRunKm");
      return {
        currentState: lr != null ? `Longest run ${lr} km` : null,
        targetState: null,
        targetDate: date("eventDate"),
        metric: lr != null ? { label: "Longest run", unit: "km", baseline: lr, target: null } : null,
      };
    }
    case "learning": {
      const wh = num("weeklyHours");
      return {
        currentState: null,
        targetState: null,
        targetDate: date("targetDate"),
        metric: wh != null ? { label: "Weekly hours", unit: "hrs", baseline: wh, target: null } : null,
      };
    }
    default: {
      const tv = num("targetValue");
      const unit = (v["unit"] ?? "").trim() || null;
      return {
        currentState: null,
        targetState: tv != null ? `${tv}${unit ? " " + unit : ""}` : null,
        targetDate: tf,
        metric: tv != null ? { label: "Target", unit, baseline: null, target: tv } : null,
      };
    }
  }
}

function fromTimeframe(tf: string | undefined, today: Date): string | null {
  const days = tf === "3m" ? 90 : tf === "6m" ? 180 : tf === "12m" ? 365 : null;
  if (days == null) return null;
  const d = new Date(today);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
