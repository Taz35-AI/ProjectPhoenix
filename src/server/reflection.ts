"use server";

import { revalidatePath } from "next/cache";
import { getAIProvider, futureYouResponseSchema, futureYouResponseHint } from "@/lib/ai";
import { buildFutureYouSystemPrompt, FUTURE_YOU_PROMPT_VERSION } from "@/lib/ai/prompts/future-you";
import { assembleFutureYouContext, validTimelineIds } from "@/lib/ai/context";
import { logAIUsage } from "@/lib/ai/usage";
import { eveningReflectionFallback } from "@/lib/ai/fallback";
import { getUserEntitlements, checkDailyMessageLimit } from "@/lib/ai/limits";
import { canUseAIReflection } from "@/lib/entitlements";
import { screenUserInput, screenAIOutput, crisisMessage, DEFAULT_CRISIS_RESOURCES } from "@/lib/safety";
import { xpFor } from "@/lib/domain/xp";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface ReflectionInput {
  body: string;
  mood?: string;
  energy?: number;
}

export interface ReflectionResponse {
  kind: "future_you" | "fallback" | "crisis";
  message: string;
  nextAction?: string;
  progressObserved?: string[];
  xpAwarded: number;
  /** Crisis only. */
  resources?: { region: string; name: string; contact: string }[];
  limitReached?: boolean;
}

/**
 * Evening reflection → grounded Future You response. The safety layer runs
 * before and after the AI. Crisis input NEVER reaches the model and is NEVER
 * gamified. On any AI failure/limit, a grounded template reply is returned.
 */
export async function submitReflection(input: ReflectionInput): Promise<ReflectionResponse> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const body = input.body.trim();
  const safety = screenUserInput(body);

  // Persist mood (user-selected) + reflection regardless of path.
  let moodEntryId: string | null = null;
  if (input.mood) {
    const { data: mood } = await supabase
      .from("mood_entries")
      .insert({ user_id: user.id, mood: input.mood, energy: input.energy ?? null })
      .select("id")
      .single();
    moodEntryId = mood?.id ?? null;
  }
  await supabase.from("reflections").insert({ user_id: user.id, body, mood_entry_id: moodEntryId });

  // --- CRISIS: stop the roleplay, no AI, no XP, no gamification -------------
  if (safety.blockAI) {
    await supabase.from("safety_events").insert({
      user_id: user.id,
      severity: "crisis",
      categories: safety.categories,
      surface: "reflection",
      ai_blocked: true,
    });
    return {
      kind: "crisis",
      message: crisisMessage(),
      xpAwarded: 0,
      resources: DEFAULT_CRISIS_RESOURCES.map((r) => ({ region: r.region, name: r.name, contact: r.contact })),
    };
  }

  if (safety.severity === "elevated") {
    await supabase.from("safety_events").insert({
      user_id: user.id,
      severity: "elevated",
      categories: safety.categories,
      surface: "reflection",
      ai_blocked: false,
    });
  }

  // Award XP for an honest reflection + mark the day active.
  const xp = xpFor("honest_reflection");
  await supabase.from("xp_transactions").insert({ user_id: user.id, amount: xp.amount, reason: xp.reason });
  const todayKey = new Date().toISOString().slice(0, 10);
  await supabase
    .from("daily_check_ins")
    .upsert({ user_id: user.id, check_in_date: todayKey }, { onConflict: "user_id,check_in_date" });

  // --- Decide AI vs fallback ----------------------------------------------
  const ent = await getUserEntitlements();
  const limit = await checkDailyMessageLimit(ent);
  const ctx = await assembleFutureYouContext();

  if (!canUseAIReflection(ent) || !limit.allowed) {
    const fb = eveningReflectionFallback({
      goalTitle: ctx.activeGoals[0]?.title ?? null,
      consistencyLine: ctx.recentConsistency,
    });
    return { kind: "fallback", message: fb.message, nextAction: fb.nextAction, xpAwarded: xp.amount, limitReached: !limit.allowed };
  }

  // --- AI path -------------------------------------------------------------
  try {
    const provider = getAIProvider();
    const { data, usage, model } = await provider.generateStructured(
      {
        system: buildFutureYouSystemPrompt(ctx),
        messages: [{ role: "user", content: `My reflection on today:\n${body}` }],
        schemaHint: futureYouResponseHint,
        maxOutputTokens: ent.maxLetterTokens,
      },
      futureYouResponseSchema,
    );

    // Post-screen: block guaranteed-outcome / unsafe / diagnosis phrasing.
    const post = screenAIOutput(data.message);
    if (post.flags.length > 0) {
      await logAIUsage({ workflow: "future_you_reflection", usage, model, promptVersion: FUTURE_YOU_PROMPT_VERSION, hadError: true, errorCode: "post_filter" });
      const fb = eveningReflectionFallback({ goalTitle: ctx.activeGoals[0]?.title ?? null, consistencyLine: ctx.recentConsistency });
      return { kind: "fallback", message: fb.message, nextAction: fb.nextAction, xpAwarded: xp.amount };
    }

    // Drop any timeline id the model invented — it may only cite real events.
    const valid = validTimelineIds(ctx);
    const citations = data.referencedTimelineEventIds.filter((id) => valid.has(id));

    await logAIUsage({ workflow: "future_you_reflection", usage, model, promptVersion: FUTURE_YOU_PROMPT_VERSION });
    await persistConversation(user.id, body, data.message);

    return {
      kind: "future_you",
      message: data.message,
      nextAction: data.nextAction,
      progressObserved: data.progressObserved,
      xpAwarded: xp.amount,
    };
  } catch {
    await logAIUsage({
      workflow: "future_you_reflection",
      usage: { inputTokens: 0, outputTokens: 0, latencyMs: 0 },
      model: "unknown",
      hadError: true,
      errorCode: "provider_error",
    });
    const fb = eveningReflectionFallback({ goalTitle: ctx.activeGoals[0]?.title ?? null, consistencyLine: ctx.recentConsistency });
    return { kind: "fallback", message: fb.message, nextAction: fb.nextAction, xpAwarded: xp.amount };
  } finally {
    revalidatePath("/home");
  }
}

async function persistConversation(userId: string, userBody: string, assistantMessage: string) {
  const supabase = createSupabaseServerClient();
  const { data: convo } = await supabase
    .from("ai_conversations")
    .insert({ user_id: userId, kind: "reflection" })
    .select("id")
    .single();
  if (!convo) return;
  await supabase.from("ai_messages").insert([
    { user_id: userId, conversation_id: convo.id, role: "user", content: userBody },
    { user_id: userId, conversation_id: convo.id, role: "assistant", content: assistantMessage },
  ]);
}
