import { serverEnv } from "@/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AIUsage } from "./types";

/**
 * Records one AI call for cost/latency tracking. NEVER stores prompt or
 * response content — only counts, model, workflow, latency, and errors.
 */
export async function logAIUsage(params: {
  workflow: string;
  usage: AIUsage;
  model: string;
  promptVersion?: string;
  hadError?: boolean;
  errorCode?: string;
}) {
  const env = serverEnv();
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const cost = await estimateCostUsd(params.model, params.usage);

  await supabase.from("ai_usage_events").insert({
    user_id: user.id,
    provider: env.AI_PROVIDER,
    model: params.model,
    prompt_version: params.promptVersion ?? null,
    workflow: params.workflow,
    input_tokens: params.usage.inputTokens,
    output_tokens: params.usage.outputTokens,
    latency_ms: params.usage.latencyMs,
    estimated_cost_usd: cost,
    had_error: params.hadError ?? false,
    error_code: params.errorCode ?? null,
  });
}

/** Pricing is configurable in `model_configurations`; unknown models cost 0. */
async function estimateCostUsd(model: string, usage: AIUsage): Promise<number> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("model_configurations")
    .select("input_price_per_mtok, output_price_per_mtok")
    .eq("model", model)
    .eq("active", true)
    .maybeSingle();
  if (!data) return 0;
  const inCost = (usage.inputTokens / 1_000_000) * Number(data.input_price_per_mtok);
  const outCost = (usage.outputTokens / 1_000_000) * Number(data.output_price_per_mtok);
  return Number((inCost + outCost).toFixed(6));
}
