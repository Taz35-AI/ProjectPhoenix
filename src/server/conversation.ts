"use server";

import { getAIProvider } from "@/lib/ai";
import { buildFutureYouConversationPrompt, FUTURE_YOU_CHAT_PROMPT_VERSION } from "@/lib/ai/prompts/future-you";
import { assembleFutureYouContext } from "@/lib/ai/context";
import { logAIUsage } from "@/lib/ai/usage";
import { getUserEntitlements, checkDailyMessageLimit } from "@/lib/ai/limits";
import { screenUserInput, screenAIOutput, crisisMessage, DEFAULT_CRISIS_RESOURCES } from "@/lib/safety";
import { sanitizeConversation } from "@/lib/ai/sanitize";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AIMessage } from "@/lib/ai/types";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResult {
  kind: "normal" | "crisis" | "fallback";
  message: string;
  resources?: { region: string; name: string; contact: string }[];
  limitReached?: boolean;
}

const HISTORY_FOR_CONTEXT = 12;

/** Loads the ongoing Future You conversation for display. */
export async function getFutureYouHistory(): Promise<ChatMessage[]> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const convo = await getConversationId(user.id, false);
  if (!convo) return [];

  const { data: rows } = await supabase
    .from("ai_messages")
    .select("role, content")
    .eq("conversation_id", convo)
    .order("created_at", { ascending: true })
    .limit(200);

  return (rows ?? [])
    .filter((r) => r.role === "user" || r.role === "assistant")
    .map((r) => ({ role: r.role as "user" | "assistant", content: r.content as string }));
}

export async function sendFutureYouMessage(text: string): Promise<ChatResult> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const body = text.trim().slice(0, 2000);
  if (!body) throw new Error("Empty message");

  const conversationId = await getConversationId(user.id, true);
  const safety = screenUserInput(body);

  // Always record the user's message.
  await supabase.from("ai_messages").insert({ user_id: user.id, conversation_id: conversationId, role: "user", content: body });

  // CRISIS: no AI, no gamification — surface real help.
  if (safety.blockAI) {
    await supabase.from("safety_events").insert({
      user_id: user.id,
      severity: "crisis",
      categories: safety.categories,
      surface: "future_you_chat",
      ai_blocked: true,
    });
    const msg = crisisMessage();
    await supabase.from("ai_messages").insert({ user_id: user.id, conversation_id: conversationId, role: "assistant", content: msg });
    return {
      kind: "crisis",
      message: msg,
      resources: DEFAULT_CRISIS_RESOURCES.map((r) => ({ region: r.region, name: r.name, contact: r.contact })),
    };
  }

  const ent = await getUserEntitlements();
  const limit = await checkDailyMessageLimit(ent);
  if (!limit.allowed) {
    const msg =
      "We've talked a fair bit today — and that's good. I'm not going anywhere; I'll be right here tomorrow. For now, what's the one small thing you can actually do before then?";
    await supabase.from("ai_messages").insert({ user_id: user.id, conversation_id: conversationId, role: "assistant", content: msg });
    return { kind: "fallback", message: msg, limitReached: true };
  }

  // Load recent history for short-term memory.
  const { data: historyRows } = await supabase
    .from("ai_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_FOR_CONTEXT + 1);
  const history: AIMessage[] = (historyRows ?? [])
    .reverse()
    .filter((r) => r.role === "user" || r.role === "assistant")
    .map((r) => ({ role: r.role as "user" | "assistant", content: r.content as string }));

  try {
    const ctx = await assembleFutureYouContext();
    const provider = getAIProvider();
    const started = Date.now();
    const res = await provider.generateText({
      system: buildFutureYouConversationPrompt(ctx),
      messages: history.length ? history : [{ role: "user", content: body }],
      maxOutputTokens: Math.min(700, ent.maxLetterTokens),
      temperature: 0.7,
    });

    let message = sanitizeConversation(res.text);
    const post = screenAIOutput(message);
    if (post.flags.length > 0 || !message) {
      message =
        "I want to be careful here rather than say something glib. What matters is what's actually in your control right now — talk me through what you're facing, and let's find the next honest step together.";
      await logAIUsage({ workflow: "future_you_chat", usage: res.usage, model: res.model, promptVersion: FUTURE_YOU_CHAT_PROMPT_VERSION, hadError: true, errorCode: "post_filter" });
    } else {
      await logAIUsage({ workflow: "future_you_chat", usage: { ...res.usage, latencyMs: Date.now() - started }, model: res.model, promptVersion: FUTURE_YOU_CHAT_PROMPT_VERSION });
    }

    await supabase.from("ai_messages").insert({ user_id: user.id, conversation_id: conversationId, role: "assistant", content: message });
    return { kind: "normal", message };
  } catch {
    const msg =
      "I'm having trouble finding words this second — but I'm still here. Tell me the one thing weighing on you most right now, and we'll start there.";
    await supabase.from("ai_messages").insert({ user_id: user.id, conversation_id: conversationId, role: "assistant", content: msg });
    await logAIUsage({
      workflow: "future_you_chat",
      usage: { inputTokens: 0, outputTokens: 0, latencyMs: 0 },
      model: "unknown",
      hadError: true,
      errorCode: "provider_error",
    });
    return { kind: "fallback", message: msg };
  }
}

async function getConversationId(userId: string, create: boolean): Promise<string | null> {
  const supabase = createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("ai_conversations")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", "future_you")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id as string;
  if (!create) return null;
  const { data: created } = await supabase
    .from("ai_conversations")
    .insert({ user_id: userId, kind: "future_you" })
    .select("id")
    .single();
  return (created?.id as string) ?? null;
}
