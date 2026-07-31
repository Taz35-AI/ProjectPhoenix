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

  const [{ data: profile }, { data: boundaries }, { data: goals }, { data: timeline }, { data: checkins }] =
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
    ]);

  const activeDays = new Set((checkins ?? []).map((c) => c.check_in_date as string));
  const consistency = computeConsistency(activeDays, new Date());

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
  };
}

/** Valid timeline IDs for this user — used to drop any citation the AI invents. */
export function validTimelineIds(ctx: FutureYouContext): Set<string> {
  return new Set(ctx.timelineEvents.map((e) => e.id));
}
