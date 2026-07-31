"use server";

import { getAIProvider, goalClassificationSchema, goalClassificationHint, type GoalClassification } from "@/lib/ai";
import { AIStructuredError } from "@/lib/ai/types";
import { buildGoalClassifyPrompt, GOAL_CLASSIFY_PROMPT_VERSION } from "@/lib/ai/prompts/goal-classify";
import { logAIUsage } from "@/lib/ai/usage";
import { screenUserInput } from "@/lib/safety";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { persistIdentity, markOnboardingComplete } from "@/server/onboarding";
import { buildRoadmap } from "@/server/roadmap";

export interface ClassifyResult {
  classification: GoalClassification;
  safety: { severity: "none" | "elevated" | "crisis"; blockAI: boolean; categories: string[] };
  usedFallback: boolean;
}

/**
 * Safety-screen → AI classify → validate. On crisis, returns WITHOUT calling the
 * AI. On AI/parse failure, returns a deterministic fallback so the flow never
 * dead-ends.
 */
export async function classifyGoal(
  rawInput: string,
  context: { focusAreas: string[]; identityTraits: string[] },
): Promise<ClassifyResult> {
  const safety = screenUserInput(rawInput);
  if (safety.blockAI) {
    await recordSafetyEvent(safety, "goal");
    return {
      safety,
      usedFallback: true,
      classification: crisisPlaceholderClassification(rawInput),
    };
  }

  const provider = getAIProvider();
  try {
    const { data, usage, model } = await provider.generateStructured(
      {
        system: buildGoalClassifyPrompt(context),
        messages: [{ role: "user", content: rawInput }],
        schemaHint: goalClassificationHint,
        maxOutputTokens: 1200,
      },
      goalClassificationSchema,
    );
    await logAIUsage({ workflow: "goal_classify", usage, model, promptVersion: GOAL_CLASSIFY_PROMPT_VERSION });
    return { classification: data, safety, usedFallback: false };
  } catch (err) {
    const code = err instanceof AIStructuredError ? "schema_validation" : "provider_error";
    await logAIUsage({
      workflow: "goal_classify",
      usage: { inputTokens: 0, outputTokens: 0, latencyMs: 0 },
      model: "unknown",
      hadError: true,
      errorCode: code,
    });
    return { classification: fallbackClassification(rawInput), safety, usedFallback: true };
  }
}

export interface ApproveGoalInput {
  sessionId: string;
  rawInput: string;
  answers: Record<string, unknown>;
  approved: {
    displayTitle: string;
    domain: GoalClassification["domain"];
    dreamOrGoal: GoalClassification["dreamOrGoal"];
    realism: GoalClassification["realismAssessment"];
    targetDate?: string | null;
  };
}

/**
 * Persists the user-APPROVED goal, creates a gentle first mission, writes the
 * timeline, and completes onboarding. Nothing here is decided by the AI — the
 * user confirmed these fields.
 */
export async function approveGoalAndFinish(input: ApproveGoalInput): Promise<{ goalId: string }> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  await persistIdentity(input.answers);

  // Keep the dream linked to the goal (the realism contract stays visible).
  const dreamText = typeof input.answers["dream"] === "string" ? (input.answers["dream"] as string).trim() : "";
  let dreamId: string | null = null;
  if (dreamText) {
    const { data: dream } = await supabase
      .from("dreams")
      .insert({ user_id: user.id, description: dreamText })
      .select("id")
      .single();
    dreamId = dream?.id ?? null;
  }

  const { data: goal, error: goalErr } = await supabase
    .from("goals")
    .insert({
      user_id: user.id,
      dream_id: dreamId,
      raw_input: input.rawInput,
      display_title: input.approved.displayTitle,
      domain: input.approved.domain,
      dream_or_goal: input.approved.dreamOrGoal,
      realism: input.approved.realism,
      target_date: input.approved.targetDate ?? null,
      status: "active",
      approval_status: "approved",
      priority: 0,
    })
    .select("id")
    .single();
  if (goalErr) throw goalErr;

  // First mission: a gentle, validated template mapped from the domain.
  const templateId = firstMissionTemplateFor(input.approved.domain);
  const { data: template } = await supabase
    .from("mission_templates")
    .select("id, title, description, mission_type, difficulty, estimated_minutes, base_xp, safety_category")
    .eq("id", templateId)
    .maybeSingle();

  if (template) {
    await supabase.from("missions").insert({
      user_id: user.id,
      goal_id: goal.id,
      template_id: template.id,
      title: template.title,
      description: template.description,
      focus_area: input.approved.domain,
      mission_type: template.mission_type,
      reason: "Your first honest move toward this goal.",
      estimated_minutes: template.estimated_minutes,
      difficulty: template.difficulty,
      xp: template.base_xp,
      completion_method: "check",
      safety_category: template.safety_category,
      approval_status: "approved",
    });
  }

  await supabase.from("timeline_events").insert([
    { user_id: user.id, event_type: "onboarding_completed", summary: "Started the journey.", tags: ["onboarding"] },
    {
      user_id: user.id,
      event_type: "goal_created",
      summary: `Set a first goal: ${input.approved.displayTitle}`,
      goal_id: goal.id,
      tags: ["goal", input.approved.domain],
    },
  ]);

  // Enter Chapter 1 — The Awakening.
  await supabase
    .from("user_chapter_progress")
    .upsert({ user_id: user.id, chapter_id: 1 }, { onConflict: "user_id,chapter_id" });

  // Build the concrete milestone roadmap for this goal (deterministic).
  await buildRoadmap(goal.id);

  await markOnboardingComplete(input.sessionId);
  return { goalId: goal.id };
}

// --- helpers ---------------------------------------------------------------
function firstMissionTemplateFor(domain: string): string {
  switch (domain) {
    case "health":
    case "fitness":
    case "nutrition":
      return "health.walk_10";
    case "running":
      return "running.easy_walk_run";
    case "learning":
      return "learning.focus_15";
    default:
      return "general.reflect_2min";
  }
}

function fallbackClassification(rawInput: string): GoalClassification {
  return {
    cleanedGoalTitle: rawInput.slice(0, 60) || "A personal goal",
    domain: "other",
    goalType: "general",
    dreamOrGoal: "goal",
    realismAssessment: "unclear",
    missingInformation: ["a measurable indicator", "a rough timeframe"],
    clarificationQuestion: "What would count as real progress in the next 90 days?",
    suggestedMeasurableIndicators: ["a small weekly action you can repeat"],
    safetyFlags: [],
    requiresUserApproval: true,
  };
}

function crisisPlaceholderClassification(rawInput: string): GoalClassification {
  return {
    cleanedGoalTitle: rawInput.slice(0, 60) || "Let's pause here",
    domain: "mental_wellbeing",
    goalType: "wellbeing",
    dreamOrGoal: "goal",
    realismAssessment: "unsafe",
    missingInformation: [],
    clarificationQuestion: null,
    suggestedMeasurableIndicators: [],
    safetyFlags: ["crisis"],
    requiresUserApproval: true,
  };
}

async function recordSafetyEvent(
  safety: { severity: "none" | "elevated" | "crisis"; categories: string[]; blockAI: boolean },
  surface: string,
) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("safety_events").insert({
    user_id: user.id,
    severity: safety.severity,
    categories: safety.categories,
    surface,
    ai_blocked: safety.blockAI,
  });
}
