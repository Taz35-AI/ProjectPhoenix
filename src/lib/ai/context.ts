import { createSupabaseServerClient } from "@/lib/supabase/server";
import { computeConsistency, consistencyMessage } from "@/lib/domain/consistency";
import type { FutureYouContext } from "@/lib/ai/prompts/future-you";

/**
 * Assembles the layered memory for a Future You call. We never send full
 * history — only: stable profile, active state, recent consistency, and a small
 * set of recent timeline events the model MAY cite (by id). This keeps cost
 * bounded and citations grounded.
 */
export async function assembleFutureYouContext(): Promise<FutureYouContext> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const [{ data: profile }, { data: boundaries }, { data: goals }, { data: timeline }, { data: checkins }, { data: reflections }] =
    await Promise.all([
      supabase
        .from("future_self_profiles")
        .select("title, identity_traits, values, long_term_dream, communication_style, intensity, reason_for_starting")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase.from("user_boundaries").select("topic, handling").eq("user_id", user.id),
      supabase
        .from("goals")
        .select("id, display_title, target_state, dream_or_goal")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("priority", { ascending: true })
        .limit(3),
      supabase
        .from("timeline_events")
        .select("id, summary, occurred_at")
        .eq("user_id", user.id)
        .order("occurred_at", { ascending: false })
        .limit(6),
      supabase
        .from("daily_check_ins")
        .select("check_in_date")
        .eq("user_id", user.id)
        .order("check_in_date", { ascending: false })
        .limit(30),
      supabase
        .from("reflections")
        .select("body, created_at")
        .eq("user_id", user.id)
        .eq("exclude_from_ai_memory", false)
        .order("created_at", { ascending: false })
        .limit(3),
    ]);

  const activeDays = new Set((checkins ?? []).map((c) => c.check_in_date as string));
  const consistency = computeConsistency(activeDays, new Date());

  // Next milestone on the primary goal, for concrete continuity.
  const primaryGoalId = goals?.[0]?.id as string | undefined;
  let nextMilestone: string | null = null;
  if (primaryGoalId) {
    const { data: ms } = await supabase
      .from("milestones")
      .select("title")
      .eq("user_id", user.id)
      .eq("goal_id", primaryGoalId)
      .is("achieved_at", null)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();
    nextMilestone = (ms?.title as string | null) ?? null;
  }

  const intensity = (profile?.intensity as FutureYouContext["intensity"] | null) ?? {
    encouragement: 3,
    directness: 3,
    accountability: 3,
    detail: 3,
  };

  return {
    identityTraits: (profile?.identity_traits as string[] | null) ?? [],
    values: (profile?.values as string[] | null) ?? [],
    longTermDream: profile?.long_term_dream ?? null,
    communicationStyle: profile?.communication_style ?? "A balanced mix",
    intensity,
    avoidTopics: (boundaries ?? []).filter((b) => b.handling === "avoid").map((b) => b.topic),
    reasonForStarting: profile?.reason_for_starting ?? null,
    activeGoals: (goals ?? []).map((g) => ({
      id: g.id as string,
      title: g.display_title as string,
      realisticTarget: (g.target_state as string | null) ?? null,
    })),
    currentChapter: null, // wired in Phase 4
    recentConsistency: consistencyMessage(consistency),
    timelineEvents: (timeline ?? []).map((t) => ({
      id: t.id as string,
      date: new Date(t.occurred_at as string).toISOString().slice(0, 10),
      summary: t.summary as string,
    })),
    recentReflections: (reflections ?? []).map((r) => ({
      date: new Date(r.created_at as string).toISOString().slice(0, 10),
      excerpt: excerpt(r.body as string, 180),
    })),
    nextMilestone,
  };
}

function excerpt(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max) + "…" : clean;
}

/** Valid timeline IDs for this user — used to drop any citation the AI invents. */
export function validTimelineIds(ctx: FutureYouContext): Set<string> {
  return new Set(ctx.timelineEvents.map((e) => e.id));
}
