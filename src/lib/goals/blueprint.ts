import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resourcesForDomain, readingPlan, horizonDays, type ReadingPlan } from "@/lib/goals/resources";

/**
 * The "course of action" for a goal — assembles EVERYTHING the user gave us
 * (goal, why/dream, identity, what-feels-hardest) into a concrete, detailed
 * plan: milestones + curated resources with a real pace + daily anchors +
 * how it adapts to them.
 */

export interface BlueprintMilestone {
  title: string;
  targetDate: string | null;
  achieved: boolean;
}

export interface Blueprint {
  goalId: string;
  title: string;
  domain: string;
  currentState: string | null;
  targetState: string | null;
  targetDate: string | null;
  dreamOrGoal: string;
  why: string | null;
  identityTraits: string[];
  obstacles: string[];
  obstacleAdaptations: string[];
  milestones: BlueprintMilestone[];
  readingPlans: ReadingPlan[];
  dailyAnchors: string[];
}

export async function loadBlueprint(goalId: string): Promise<Blueprint | null> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: goal } = await supabase
    .from("goals")
    .select("id, display_title, domain, current_state, target_state, target_date, dream_or_goal")
    .eq("id", goalId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!goal) return null;

  const [{ data: future }, { data: obstacleAnswer }, { data: milestoneRows }] = await Promise.all([
    supabase.from("future_self_profiles").select("identity_traits, long_term_dream").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("onboarding_answers")
      .select("answer")
      .eq("user_id", user.id)
      .eq("step", "hardest")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("milestones")
      .select("title, target_date, achieved_at")
      .eq("user_id", user.id)
      .eq("goal_id", goalId)
      .order("sort_order", { ascending: true }),
  ]);

  const obstacles = Array.isArray(obstacleAnswer?.answer) ? (obstacleAnswer!.answer as string[]) : [];
  const today = new Date();
  const targetDate = (goal.target_date as string | null) ?? null;

  const resources = resourcesForDomain(goal.domain as string);
  const days = horizonDays(targetDate, today);
  const readingPlans = resources.slice(0, 2).map((r) => readingPlan(r, days));

  return {
    goalId: goal.id as string,
    title: goal.display_title as string,
    domain: goal.domain as string,
    currentState: (goal.current_state as string | null) ?? null,
    targetState: (goal.target_state as string | null) ?? null,
    targetDate,
    dreamOrGoal: goal.dream_or_goal as string,
    why: (future?.long_term_dream as string | null) ?? null,
    identityTraits: (future?.identity_traits as string[] | null) ?? [],
    obstacles,
    obstacleAdaptations: adaptationsFor(obstacles),
    milestones: (milestoneRows ?? []).map((m) => ({
      title: m.title as string,
      targetDate: (m.target_date as string | null) ?? null,
      achieved: !!m.achieved_at,
    })),
    readingPlans,
    dailyAnchors: dailyAnchorsFor(goal.domain as string),
  };
}

function adaptationsFor(obstacles: string[]): string[] {
  const out: string[] = [];
  const has = (k: string) => obstacles.includes(k);
  if (has("overwhelmed") || has("exhausted")) out.push("You told us you often feel overwhelmed — so we keep it to one small action a day, never a pile.");
  if (has("procrastinate") || has("dont_finish")) out.push("Because starting is the hard part for you, your first action each day is deliberately tiny — two minutes, not two hours.");
  if (has("inconsistent") || has("lost_discipline")) out.push("Since consistency is your challenge, we favour the same small anchor every day so it becomes automatic.");
  if (has("low_confidence")) out.push("We build in small, guaranteed wins so your confidence grows from evidence, not pep talks.");
  if (has("where_to_begin")) out.push("You weren't sure where to start — so every step here is spelled out exactly.");
  return out;
}

function dailyAnchorsFor(domain: string): string[] {
  switch (domain) {
    case "health":
    case "nutrition":
    case "fitness":
      return ["A 20–30 minute walk", "Protein with every meal", "A big glass of water before each meal", "Note what you ate here"];
    case "running":
      return ["Today's Couch-to-5K session", "5 minutes of stretching after", "Log how the run felt"];
    case "finance":
      return ["Log every expense today", "Move a small amount to savings", "One no-spend category for the day"];
    case "business":
    case "career":
      return ["30 focused minutes on your highest-leverage task", "Note one number that matters", "One outreach or learning action"];
    case "learning":
      return ["15 minutes of deliberate practice", "Read today's pages", "Write one sentence on what you learned"];
    default:
      return ["One concrete step toward the goal", "Two honest minutes of reflection"];
  }
}
