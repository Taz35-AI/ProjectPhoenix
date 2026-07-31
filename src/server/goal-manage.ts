"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildRoadmap } from "@/server/roadmap";
import type { GoalClassification } from "@/lib/ai";

/**
 * Goal management outside onboarding: add more goals, edit, pause/archive, and
 * choose the primary focus. The app intentionally nudges toward a small number
 * of active goals, but does not hard-limit them.
 */

const MAX_ACTIVE_GOALS = 5;

export interface CreateGoalInput {
  rawInput: string;
  displayTitle: string;
  domain: GoalClassification["domain"];
  dreamOrGoal: GoalClassification["dreamOrGoal"];
  realism: GoalClassification["realismAssessment"];
}

export async function createApprovedGoal(input: CreateGoalInput): Promise<{ goalId: string }> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { count } = await supabase
    .from("goals")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "active");
  if ((count ?? 0) >= MAX_ACTIVE_GOALS) {
    throw new Error(`You can have up to ${MAX_ACTIVE_GOALS} active goals. Pause or archive one first.`);
  }

  const { data: goal, error } = await supabase
    .from("goals")
    .insert({
      user_id: user.id,
      raw_input: input.rawInput,
      display_title: input.displayTitle,
      domain: input.domain,
      dream_or_goal: input.dreamOrGoal,
      realism: input.realism,
      status: "active",
      approval_status: "approved",
      priority: (count ?? 0) + 1, // new goals are secondary unless promoted
    })
    .select("id")
    .single();
  if (error) throw error;

  await supabase.from("timeline_events").insert({
    user_id: user.id,
    event_type: "goal_created",
    summary: `Added a goal: ${input.displayTitle}`,
    goal_id: goal.id,
    tags: ["goal", input.domain],
  });

  await buildRoadmap(goal.id);
  revalidatePath("/goals");
  revalidatePath("/home");
  return { goalId: goal.id };
}

const titleSchema = z.string().trim().min(2).max(120);

export async function updateGoalTitle(goalId: string, title: string) {
  const parsed = titleSchema.safeParse(title);
  if (!parsed.success) throw new Error("Title must be 2–120 characters.");
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  await supabase.from("goals").update({ display_title: parsed.data }).eq("id", goalId).eq("user_id", user.id);
  revalidatePath("/goals");
  revalidatePath("/home");
}

export async function setGoalStatus(goalId: string, status: "active" | "paused" | "archived") {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  await supabase.from("goals").update({ status }).eq("id", goalId).eq("user_id", user.id);
  revalidatePath("/goals");
  revalidatePath("/home");
}

/** Make a goal the primary focus (priority 0); demote the rest. */
export async function setPrimaryGoal(goalId: string) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Bump everyone down, then set this one to 0.
  await supabase.from("goals").update({ priority: 1 }).eq("user_id", user.id).eq("status", "active");
  await supabase.from("goals").update({ priority: 0, status: "active" }).eq("id", goalId).eq("user_id", user.id);
  revalidatePath("/goals");
  revalidatePath("/home");
}
