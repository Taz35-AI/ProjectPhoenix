"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateRoadmap, type RoadmapGoal } from "@/lib/domain/milestones";

export interface RoadmapMilestone {
  id: string;
  title: string;
  description: string | null;
  targetValue: number | null;
  unit: string | null;
  targetDate: string | null;
  achievedAt: string | null;
  sortOrder: number;
}

export interface RoadmapResult {
  milestones: RoadmapMilestone[];
  method: string;
  note: string | null;
}

/**
 * Builds a deterministic milestone roadmap for the user's active goal (or a
 * given goalId) and stores it. Numbers/dates come from `generateRoadmap` — the
 * app, not the AI. Replaces any existing unachieved milestones.
 */
export async function buildRoadmap(goalId?: string): Promise<RoadmapResult> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const goalQuery = supabase
    .from("goals")
    .select("id, domain, display_title, raw_input, current_state, target_state, target_date")
    .eq("user_id", user.id);
  const { data: goal } = goalId
    ? await goalQuery.eq("id", goalId).maybeSingle()
    : await goalQuery.eq("status", "active").order("priority", { ascending: true }).limit(1).maybeSingle();

  if (!goal) return { milestones: [], method: "none", note: null };

  const roadmapGoal: RoadmapGoal = {
    domain: goal.domain as string,
    displayTitle: goal.display_title as string,
    rawInput: goal.raw_input as string,
    currentState: (goal.current_state as string | null) ?? null,
    targetState: (goal.target_state as string | null) ?? null,
    targetDate: (goal.target_date as string | null) ?? null,
  };

  const roadmap = generateRoadmap(roadmapGoal, new Date());

  // Replace existing (unachieved) milestones for a clean rebuild.
  await supabase.from("milestones").delete().eq("user_id", user.id).eq("goal_id", goal.id).is("achieved_at", null);

  const rows = roadmap.milestones.map((m) => ({
    user_id: user.id,
    goal_id: goal.id,
    title: m.title,
    description: m.description,
    target_date: m.targetDate,
    sort_order: m.sortOrder,
  }));
  const { data: inserted } = await supabase
    .from("milestones")
    .insert(rows)
    .select("id, title, description, target_date, achieved_at, sort_order");

  revalidatePath("/home");

  const specByOrder = new Map(roadmap.milestones.map((m) => [m.sortOrder, m]));
  return {
    milestones: (inserted ?? []).map((r) => ({
      id: r.id as string,
      title: r.title as string,
      description: (r.description as string | null) ?? null,
      targetValue: specByOrder.get(r.sort_order as number)?.targetValue ?? null,
      unit: specByOrder.get(r.sort_order as number)?.unit ?? null,
      targetDate: (r.target_date as string | null) ?? null,
      achievedAt: (r.achieved_at as string | null) ?? null,
      sortOrder: r.sort_order as number,
    })),
    method: roadmap.method,
    note: roadmap.note,
  };
}
