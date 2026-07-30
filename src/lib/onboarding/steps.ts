/**
 * Onboarding as data. One focused question per screen, ~80% structured choice /
 * ~20% meaningful free text. The wizard renders these generically and persists
 * each answer so a user can leave and resume. Steps can be filtered dynamically
 * based on earlier answers (see `visibleSteps`).
 */

export type StepKind = "intro" | "single" | "multi" | "text" | "goal" | "review";

export interface Option {
  value: string;
  label: string;
}

export interface OnboardingStep {
  id: string;
  kind: StepKind;
  title: string;
  subtitle?: string;
  /** For choice steps. */
  options?: Option[];
  /** Max selectable for `multi`. */
  max?: number;
  /** Allow a free-text "something else" alongside choices. */
  allowOther?: boolean;
  /** For `text`. */
  placeholder?: string;
  optional?: boolean;
  /** Primary CTA label override. */
  cta?: string;
}

export const FOCUS_OPTIONS: Option[] = [
  { value: "lose_weight", label: "Lose weight" },
  { value: "get_fitter", label: "Get fitter" },
  { value: "build_strength", label: "Build strength" },
  { value: "improve_sleep", label: "Improve sleep" },
  { value: "mental_wellbeing", label: "Improve mental wellbeing" },
  { value: "after_breakup", label: "Recover after a breakup" },
  { value: "confidence", label: "Build confidence" },
  { value: "discipline", label: "Become more disciplined" },
  { value: "learn_skill", label: "Learn a skill" },
  { value: "change_career", label: "Change career" },
  { value: "build_business", label: "Build a business" },
  { value: "finances", label: "Improve finances" },
  { value: "reduce_debt", label: "Reduce debt" },
  { value: "relationships", label: "Improve relationships" },
  { value: "better_partner", label: "Become a better partner" },
  { value: "better_parent", label: "Become a better parent" },
  { value: "home", label: "Improve my home or environment" },
  { value: "less_stuck", label: "Feel less stuck" },
];

const HARDEST_OPTIONS: Option[] = [
  { value: "procrastinate", label: "I procrastinate" },
  { value: "dont_finish", label: "I start but don't finish" },
  { value: "overwhelmed", label: "I feel overwhelmed" },
  { value: "exhausted", label: "I feel exhausted" },
  { value: "low_confidence", label: "I lack confidence" },
  { value: "where_to_begin", label: "I don't know where to begin" },
  { value: "lost_discipline", label: "I have lost discipline" },
  { value: "behind", label: "I feel behind in life" },
  { value: "recovering", label: "I'm recovering from something difficult" },
  { value: "inconsistent", label: "I struggle to stay consistent" },
];

const IDENTITY_OPTIONS: Option[] = [
  "Disciplined","Calm","Healthy","Strong","Brave","Reliable","Consistent","Present",
  "Patient","Confident","Resilient","Kind","Focused","Curious","Financially responsible",
  "Emotionally mature","Honest","Organised","Creative","Independent",
].map((t) => ({ value: t.toLowerCase().replace(/\s+/g, "_"), label: t }));

const GUIDANCE_OPTIONS: Option[] = [
  { value: "warm", label: "Warm and supportive" },
  { value: "calm", label: "Calm and reflective" },
  { value: "honest", label: "Honest and direct" },
  { value: "firm", label: "Firm but respectful" },
  { value: "short", label: "Short and practical" },
  { value: "detailed", label: "Detailed and analytical" },
  { value: "balanced", label: "A balanced mix" },
];

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "intro",
    kind: "intro",
    title: "This isn't about becoming perfect.",
    subtitle:
      "It's about becoming the person you promised yourself you'd be. Future You is a simulated guide — not a prediction of your future. We'll make one honest move at a time.",
    cta: "Begin the journey",
  },
  {
    id: "focus_areas",
    kind: "multi",
    title: "Why are you here?",
    subtitle: "Choose up to three. We'll keep your focus small on purpose.",
    options: FOCUS_OPTIONS,
    max: 3,
    allowOther: true,
  },
  {
    id: "hardest",
    kind: "multi",
    title: "What feels hardest right now?",
    subtitle: "Be honest — this shapes how Future You supports you.",
    options: HARDEST_OPTIONS,
    max: 3,
    allowOther: true,
  },
  {
    id: "dream",
    kind: "text",
    title: "If your life improved beyond what feels possible, what would it look like?",
    subtitle: "This is a long-term dream, not a guaranteed prediction. Dream honestly.",
    placeholder: "A year or two from now, on a good day, I…",
  },
  {
    id: "one_year",
    kind: "text",
    title: "One year from now, what progress would make you genuinely proud?",
    subtitle: "Something real and specific enough that you'd know you'd achieved it.",
    placeholder: "I'd be proud if I had…",
  },
  {
    id: "identity",
    kind: "multi",
    title: "Who do you want to become?",
    subtitle: "Choose up to five traits. This becomes the identity we build toward.",
    options: IDENTITY_OPTIONS,
    max: 5,
    allowOther: true,
  },
  {
    id: "guidance",
    kind: "single",
    title: "How should Future You speak to you?",
    subtitle: "You can change this any time.",
    options: GUIDANCE_OPTIONS,
  },
  {
    id: "primary_goal",
    kind: "goal",
    title: "Name the one goal to start with.",
    subtitle:
      "In your own words. Future You will help turn it into a realistic, controllable path — and gently flag anything that needs a reality check.",
    placeholder: "e.g. Lose 25 kg · Run a marathon · Learn JavaScript · Become debt free",
    cta: "Show me the plan",
  },
];

/** Dynamic filtering hook — currently linear, but ready for branch logic. */
export function visibleSteps(_answers: Record<string, unknown>): OnboardingStep[] {
  return ONBOARDING_STEPS;
}

export const FIRST_STEP_ID = ONBOARDING_STEPS[0]!.id;
