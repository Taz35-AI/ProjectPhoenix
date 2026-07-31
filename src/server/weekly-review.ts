"use server";

import { getAIProvider, weeklyReviewSchema, weeklyReviewHint, type WeeklyReview } from "@/lib/ai";
import { buildWeeklyReviewPrompt, WEEKLY_REVIEW_PROMPT_VERSION, type WeekStats } from "@/lib/ai/prompts/weekly-review";
import { logAIUsage } from "@/lib/ai/usage";
import { weeklyReviewFallback } from "@/lib/ai/fallback";
import { getUserEntitlements, checkDailyMessageLimit } from "@/lib/ai/limits";
import { screenAIOutput } from "@/lib/safety";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface WeeklyReviewResult {
  stats: WeekStats;
  review: WeeklyReview;
  source: "ai" | "fallback";
}

/** Deterministic stats for the trailing 7 days. */
async function computeWeekStats(userId: string): Promise<WeekStats> {
  const supabase = createSupabaseServerClient();
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  const startKey = start.toISOString().slice(0, 10);
  const startIso = new Date(startKey + "T00:00:00.000Z").toISOString();

  const [results, reflections, checkins, xp, comebacks] = await Promise.all([
    supabase.from("mission_results").select("status").eq("user_id", userId).gte("created_at", startIso),
    supabase.from("reflections").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", startIso),
    supabase.from("daily_check_ins").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("check_in_date", startKey),
    supabase.from("xp_transactions").select("amount").eq("user_id", userId).gte("created_at", startIso),
    supabase.from("timeline_events").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("event_type", "comeback").gte("occurred_at", startIso),
  ]);

  const rows = results.data ?? [];
  return {
    periodStart: startKey,
    periodEnd: end.toISOString().slice(0, 10),
    missionsCompleted: rows.filter((r) => r.status === "completed").length,
    missionsPartial: rows.filter((r) => r.status === "partial").length,
    missionsSkipped: rows.filter((r) => r.status === "skipped").length,
    reflections: reflections.count ?? 0,
    activeDays: checkins.count ?? 0,
    xpThisWeek: (xp.data ?? []).reduce((s, r) => s + Number(r.amount), 0),
    comebacks: comebacks.count ?? 0,
  };
}

/**
 * Generates (or regenerates) this week's review. Stats are deterministic; the
 * AI only interprets them and its "adjustment" is a proposal — nothing about
 * the user's goals changes automatically.
 */
export async function generateWeeklyReview(goalTitle: string | null): Promise<WeeklyReviewResult> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const stats = await computeWeekStats(user.id);

  const ent = await getUserEntitlements();
  const limit = await checkDailyMessageLimit(ent);

  let review: WeeklyReview;
  let source: "ai" | "fallback" = "fallback";

  if (limit.allowed) {
    try {
      const provider = getAIProvider();
      const { data, usage, model } = await provider.generateStructured(
        {
          system: buildWeeklyReviewPrompt(stats, goalTitle),
          messages: [{ role: "user", content: "Write my weekly review from these stats." }],
          schemaHint: weeklyReviewHint,
          maxOutputTokens: ent.maxLetterTokens,
        },
        weeklyReviewSchema,
      );
      const post = screenAIOutput(data.message);
      if (post.flags.length === 0) {
        await logAIUsage({ workflow: "weekly_review", usage, model, promptVersion: WEEKLY_REVIEW_PROMPT_VERSION });
        review = data;
        source = "ai";
      } else {
        await logAIUsage({ workflow: "weekly_review", usage, model, promptVersion: WEEKLY_REVIEW_PROMPT_VERSION, hadError: true, errorCode: "post_filter" });
        review = { ...weeklyReviewFallback({ ...stats, goalTitle }) };
      }
    } catch {
      review = { ...weeklyReviewFallback({ ...stats, goalTitle }) };
    }
  } else {
    review = { ...weeklyReviewFallback({ ...stats, goalTitle }) };
  }

  await supabase.from("weekly_reviews").upsert(
    {
      user_id: user.id,
      period_start: stats.periodStart,
      period_end: stats.periodEnd,
      stats: stats as never,
      interpretation: review as never,
      source,
    },
    { onConflict: "user_id,period_start" },
  );

  await supabase.from("timeline_events").insert({
    user_id: user.id,
    event_type: "weekly_review",
    summary: `Weekly review: ${stats.missionsCompleted} completed, active ${stats.activeDays}/7 days.`,
    tags: ["review"],
  });

  return { stats, review, source };
}
