"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface OnboardingSnapshot {
  sessionId: string;
  currentStep: string;
  completed: boolean;
  answers: Record<string, unknown>;
}

/** Load the user's onboarding session (creating one on first visit). */
export async function ensureSession(): Promise<OnboardingSnapshot> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  let { data: session } = await supabase
    .from("onboarding_sessions")
    .select("id, current_step, completed")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) {
    const { data: created, error } = await supabase
      .from("onboarding_sessions")
      .insert({ user_id: user.id, current_step: "intro" })
      .select("id, current_step, completed")
      .single();
    if (error) throw error;
    session = created;
  }

  const { data: answerRows } = await supabase
    .from("onboarding_answers")
    .select("step, answer")
    .eq("session_id", session.id);

  const answers: Record<string, unknown> = {};
  for (const row of answerRows ?? []) answers[row.step] = row.answer;

  return {
    sessionId: session.id,
    currentStep: session.current_step,
    completed: session.completed,
    answers,
  };
}

/** Persist a single step's answer and advance the cursor. Enables resume. */
export async function saveStep(
  sessionId: string,
  step: string,
  answer: unknown,
  nextStep: string,
): Promise<{ ok: true }> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error: upsertErr } = await supabase
    .from("onboarding_answers")
    .upsert(
      { session_id: sessionId, user_id: user.id, step, answer: answer as never },
      { onConflict: "session_id,step" },
    );
  if (upsertErr) throw upsertErr;

  const { error: sessErr } = await supabase
    .from("onboarding_sessions")
    .update({ current_step: nextStep })
    .eq("id", sessionId)
    .eq("user_id", user.id);
  if (sessErr) throw sessErr;

  return { ok: true };
}

/** Map raw guidance choice → communication style string stored on the profile. */
const GUIDANCE_LABELS: Record<string, string> = {
  warm: "Warm and supportive",
  calm: "Calm and reflective",
  honest: "Honest and direct",
  firm: "Firm but respectful",
  short: "Short and practical",
  detailed: "Detailed and analytical",
  balanced: "A balanced mix",
};

/**
 * Writes the durable identity from onboarding answers into future_self_profiles
 * and user_focus_areas. Called once the user reaches the goal step. Idempotent.
 */
export async function persistIdentity(answers: Record<string, unknown>): Promise<{ ok: true }> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const identity = asStringArray(answers["identity"]);
  const guidanceRaw = asChoice(answers["guidance"]);
  const dream = asText(answers["dream"]);
  const hardest = asStringArray(answers["hardest"]);

  await supabase
    .from("future_self_profiles")
    .update({
      identity_traits: identity,
      communication_style: GUIDANCE_LABELS[guidanceRaw ?? "balanced"] ?? "A balanced mix",
      long_term_dream: dream || null,
      reason_for_starting: hardest.length ? `Working through: ${hardest.join(", ")}` : null,
    })
    .eq("user_id", user.id);

  // Map focus-area answers onto seeded life_areas where the value matches.
  const focus = asStringArray(answers["focus_areas"]);
  const { data: areas } = await supabase.from("life_areas").select("id");
  const areaIds = new Set((areas ?? []).map((a) => a.id));
  const matched = focus.filter((f) => areaIds.has(f)).slice(0, 3);

  if (matched.length) {
    await supabase.from("user_focus_areas").upsert(
      matched.map((life_area_id, i) => ({ user_id: user.id, life_area_id, priority: i })),
      { onConflict: "user_id,life_area_id" },
    );
  }

  return { ok: true };
}

export async function markOnboardingComplete(sessionId: string) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  await supabase
    .from("onboarding_sessions")
    .update({ completed: true })
    .eq("id", sessionId)
    .eq("user_id", user.id);
  await supabase
    .from("profiles")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", user.id);

  revalidatePath("/home");
}

// --- coercion helpers (answers are JSONB) ---------------------------------
function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}
function asChoice(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}
function asText(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
