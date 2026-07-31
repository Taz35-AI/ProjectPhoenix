"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildGoalUpdate } from "@/lib/goals/specifics";
import { buildRoadmap } from "@/server/roadmap";

/**
 * Saves a goal's structured specifics (current/target/timeframe as real values)
 * and rebuilds its milestone roadmap from that structured data — no free-text
 * parsing. This is what turns a vague goal into a concrete, dated course.
 */
export async function saveGoalSpecifics(goalId: string, values: Record<string, string>) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: goal } = await supabase
    .from("goals")
    .select("id, domain")
    .eq("id", goalId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!goal) throw new Error("Goal not found");

  const update = buildGoalUpdate(goal.domain as string, values, new Date());

  await supabase
    .from("goals")
    .update({
      current_state: update.currentState,
      target_state: update.targetState,
      target_date: update.targetDate,
    })
    .eq("id", goalId)
    .eq("user_id", user.id);

  if (update.metric) {
    // One canonical metric per goal for now: clear + insert.
    await supabase.from("goal_metrics").delete().eq("goal_id", goalId).eq("user_id", user.id);
    await supabase.from("goal_metrics").insert({
      user_id: user.id,
      goal_id: goalId,
      label: update.metric.label,
      unit: update.metric.unit,
      baseline: update.metric.baseline,
      target: update.metric.target,
      current: update.metric.baseline,
    });
  }

  const roadmap = await buildRoadmap(goalId);
  revalidatePath("/home");
  revalidatePath("/goals");
  return { roadmap };
}
