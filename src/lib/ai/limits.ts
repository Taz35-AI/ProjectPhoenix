import { createSupabaseServerClient } from "@/lib/supabase/server";
import { entitlementsFor, type Entitlements, type Tier } from "@/lib/entitlements";

/** Resolve the current user's entitlements from their subscription row. */
export async function getUserEntitlements(): Promise<Entitlements> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return entitlementsFor("free");

  const { data } = await supabase
    .from("subscriptions")
    .select("tier")
    .eq("user_id", user.id)
    .maybeSingle();
  return entitlementsFor((data?.tier as Tier) ?? "free");
}

export interface LimitStatus {
  allowed: boolean;
  usedToday: number;
  limit: number;
}

/**
 * Deterministic daily-message gate. Counts today's successful AI calls and
 * compares against the tier limit. When exceeded, callers fall back to
 * template content — the app never dead-ends on a limit.
 */
export async function checkDailyMessageLimit(e: Entitlements): Promise<LimitStatus> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { allowed: false, usedToday: 0, limit: e.dailyAIMessages };

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const { count } = await supabase
    .from("ai_usage_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("had_error", false)
    .gte("created_at", startOfDay.toISOString());

  const usedToday = count ?? 0;
  return { allowed: usedToday < e.dailyAIMessages, usedToday, limit: e.dailyAIMessages };
}
