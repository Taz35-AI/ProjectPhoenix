import { serverEnv } from "@/env";
import type { AIProvider } from "./types";
import { MockProvider } from "./providers/mock";
import { OpenAICompatibleProvider } from "./providers/openai-compatible";

export * from "./types";
export * from "./schemas";

/**
 * Server-only factory. Reads `AI_PROVIDER` and returns the matching adapter.
 * Product code depends on the AIProvider interface and calls `getAIProvider()`
 * — it never imports a concrete provider, so swapping models is a config change.
 */
let cached: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (cached) return cached;
  const env = serverEnv();

  switch (env.AI_PROVIDER) {
    case "openai-compatible": {
      if (!env.AI_BASE_URL || !env.AI_API_KEY) {
        // Fail safe to mock rather than crash a request; log loudly.
        console.warn(
          "[ai] AI_PROVIDER=openai-compatible but AI_BASE_URL/AI_API_KEY missing — falling back to MockProvider.",
        );
        cached = new MockProvider();
        break;
      }
      cached = new OpenAICompatibleProvider({
        baseUrl: env.AI_BASE_URL,
        apiKey: env.AI_API_KEY,
        model: env.AI_MODEL,
        timeoutMs: env.AI_TIMEOUT_MS,
        maxOutputTokens: env.AI_MAX_OUTPUT_TOKENS,
        temperature: env.AI_TEMPERATURE,
      });
      break;
    }
    case "mock":
    default:
      cached = new MockProvider();
  }
  return cached;
}

/** Test helper to reset the singleton between cases. */
export function __resetAIProvider() {
  cached = null;
}
