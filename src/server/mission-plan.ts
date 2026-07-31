"use server";

import { revalidatePath } from "next/cache";
import { getAIProvider, dailyMissionsSchema } from "@/lib/ai";
import { buildMissionsPrompt, MISSIONS_PROMPT_VERSION } from "@/lib/ai/prompts/missions";
import { logAIUsage } from "@/lib/ai/usage";
import { fallbackMissionsFor } from "@/lib/ai/fallback";
import { getUserEntitlements, checkDailyMessageLimit } from "@/lib/ai/limits";
import { validateMission, xpForSuggestedMission, type MissionValidationContext } from "@/lib/domain/mission-safety";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const missionsHint = `{
  "missions": array of 1 to 3 objects, each:
    {
      "title": short concrete action (<=80 chars),
      "description": one specific sentence,
      "focusArea": the goal domain,
      "missionType": one of ["primary","maintenance","courage","recovery","reflection"],
      "reason": why this helps today,
      "estimatedMinutes": integer minutes,
      "difficulty": one of ["gentle","moderate","stretch"],
      "completionMethod": one of ["check","note","duration","quantity","evidence"],
      "templateId": null
    }
}`;

export interface GeneratedMission {
  id: string;
  title: string;
  description: string | null;
  estimatedMinutes: number;
  xp: number;
  missionType: string;
}

export interface GenerateMissionsResult {
  missions: GeneratedMission[];
  source: "ai" | "fallback";
}

/**
 * Generates today's concrete, goal-specific missions. The AI proposes; the
 * deterministic safety validator gates every suggestion; the app assigns XP.
 * Idempotent per day: if missions already exist for today, returns those.
 */
export async function generateDailyMissions(): Promise<GenerateMissionsResult> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const todayKey = new Date().toISOString().slice(0, 10);

  // If today already has missions, don't spend AI — return them.
  const { data: existing } = await supabase
    .from("missions")
    .select("id, title, description, estimated_minutes, xp, mission_type")
    .eq("user_id", user.id)
    .eq("scheduled_for", todayKey)
    .order("created_at", { ascending: true });
  if (existing && existing.length > 0) {
    return { missions: existing.map(rowToMission), source: "ai" };
  }

  // Load goal + constraints + identity for grounding.
  const { data: goal } = await supabase
    .from("goals")
    .select("id, display_title, domain, current_state, target_state")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("priority", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!goal) return { missions: [], source: "fallback" };

  const [{ data: constraintRows }, { data: future }, { data: recent }, { data: obstacleAnswer }, { data: nextMilestone }] =
    await Promise.all([
      supabase.from("goal_constraints").select("detail").eq("goal_id", goal.id),
      supabase.from("future_self_profiles").select("identity_traits").eq("user_id", user.id).maybeSingle(),
      supabase.from("missions").select("title").eq("user_id", user.id).order("created_at", { ascending: false }).limit(6),
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
        .select("title")
        .eq("user_id", user.id)
        .eq("goal_id", goal.id)
        .is("achieved_at", null)
        .order("sort_order", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

  const constraints = (constraintRows ?? []).map((c) => c.detail as string);
  const obstacles = Array.isArray(obstacleAnswer?.answer) ? (obstacleAnswer!.answer as string[]) : [];
  // Overwhelm/exhaustion → fewer missions; other obstacles → keep it modest.
  const maxMissions = obstacles.some((o) => ["overwhelmed", "exhausted"].includes(o))
    ? 1
    : obstacles.some((o) => ["procrastinate", "dont_finish", "inconsistent"].includes(o))
      ? 2
      : 3;
  const valCtx: MissionValidationContext = { domain: goal.domain as string, availableMinutes: 30, constraints };

  const ent = await getUserEntitlements();
  const limit = await checkDailyMessageLimit(ent);

  let suggestions: {
    title: string;
    description: string;
    missionType: GeneratedMission["missionType"];
    estimatedMinutes: number;
    difficulty: "gentle" | "moderate" | "stretch";
  }[] = [];
  let source: "ai" | "fallback" = "fallback";

  if (limit.allowed) {
    try {
      const provider = getAIProvider();
      const { data, usage, model } = await provider.generateStructured(
        {
          system: buildMissionsPrompt({
            goalTitle: goal.display_title as string,
            domain: goal.domain as string,
            currentState: (goal.current_state as string | null) ?? null,
            targetState: (goal.target_state as string | null) ?? null,
            constraints,
            availableMinutes: 30,
            recentMissionTitles: (recent ?? []).map((r) => r.title as string),
            identityTraits: ((future?.identity_traits as string[] | null) ?? []),
            obstacles,
            currentMilestone: (nextMilestone?.title as string | null) ?? null,
            maxMissions,
          }),
          messages: [{ role: "user", content: "Generate today's missions." }],
          schemaHint: missionsHint,
          maxOutputTokens: 900,
        },
        dailyMissionsSchema,
      );

      // Deterministic gate: validate every suggestion; drop unsafe ones.
      const validated = data.missions
        .map((m) => validateMission(m, valCtx))
        .filter((v) => v.ok)
        .map((v) => v.mission);

      if (validated.length > 0) {
        await logAIUsage({ workflow: "mission_plan", usage, model, promptVersion: MISSIONS_PROMPT_VERSION });
        suggestions = validated.map((m) => ({
          title: m.title,
          description: m.description,
          missionType: m.missionType,
          estimatedMinutes: m.estimatedMinutes,
          difficulty: m.difficulty,
        }));
        source = "ai";
      } else {
        await logAIUsage({ workflow: "mission_plan", usage, model, promptVersion: MISSIONS_PROMPT_VERSION, hadError: true, errorCode: "all_rejected" });
      }
    } catch {
      /* fall through to fallback */
    }
  }

  if (suggestions.length === 0) {
    suggestions = fallbackMissionsFor(goal.domain as string).map((m) => ({ ...m }));
  }

  // Persist. XP is assigned by the app from difficulty, never by the model.
  const rows = suggestions.slice(0, maxMissions).map((m, i) => ({
    user_id: user.id,
    goal_id: goal.id,
    template_id: null,
    title: m.title,
    description: m.description,
    focus_area: goal.domain,
    mission_type: m.missionType,
    reason: i === 0 ? "Your primary move for today." : "A supporting step, if you have capacity.",
    estimated_minutes: m.estimatedMinutes,
    difficulty: m.difficulty,
    xp: xpForSuggestedMission(m.difficulty),
    completion_method: "check",
    approval_status: "approved",
    scheduled_for: todayKey,
  }));

  const { data: inserted } = await supabase
    .from("missions")
    .insert(rows)
    .select("id, title, description, estimated_minutes, xp, mission_type");

  revalidatePath("/home");
  return { missions: (inserted ?? []).map(rowToMission), source };
}

function rowToMission(r: {
  id: string;
  title: string;
  description: string | null;
  estimated_minutes: number;
  xp: number;
  mission_type: string;
}): GeneratedMission {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    estimatedMinutes: r.estimated_minutes,
    xp: r.xp,
    missionType: r.mission_type,
  };
}
