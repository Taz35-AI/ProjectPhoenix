import type { z } from "zod";

/**
 * Provider-independent AI contract.
 *
 * Product logic MUST depend only on this interface — never on a concrete
 * provider. Swapping Qwen -> OpenAI/Anthropic/Groq/etc. must not require
 * touching any product code, only `AI_PROVIDER` env + a provider adapter.
 */

export type AIMessageRole = "system" | "user" | "assistant";

export interface AIMessage {
  role: AIMessageRole;
  content: string;
}

export interface AITextRequest {
  /** System prompt is passed separately so providers can place it correctly. */
  system?: string;
  messages: AIMessage[];
  /** Per-call overrides; provider clamps to configured maxima. */
  temperature?: number;
  maxOutputTokens?: number;
  /** Correlates usage logging + tracing across the request lifecycle. */
  requestId?: string;
}

export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
  /** Wall-clock latency measured by the caller, not the provider. */
  latencyMs: number;
}

export interface AITextResponse {
  text: string;
  usage: AIUsage;
  model: string;
  finishReason: "stop" | "length" | "content_filter" | "error" | "unknown";
}

export interface AIStructuredRequest extends AITextRequest {
  /**
   * Human description of the expected JSON shape, injected into the prompt.
   * The Zod schema remains the source of truth for validation.
   */
  schemaHint?: string;
}

/**
 * Concrete providers implement this. `generateStructured` is expected to:
 *   1. prompt for JSON,
 *   2. validate against the Zod schema,
 *   3. retry ONCE with a repair prompt on failure,
 *   4. throw `AIStructuredError` if the second attempt also fails
 *      (callers then use a deterministic fallback — never a broken UI).
 */
export interface AIProvider {
  readonly id: string;
  generateText(request: AITextRequest): Promise<AITextResponse>;
  generateStructured<T>(
    request: AIStructuredRequest,
    schema: z.ZodSchema<T>,
  ): Promise<{ data: T; usage: AIUsage; model: string }>;
  streamText?(request: AITextRequest): Promise<ReadableStream<Uint8Array>>;
}

export class AIStructuredError extends Error {
  constructor(
    message: string,
    readonly rawOutput: string,
    readonly validationIssues?: unknown,
  ) {
    super(message);
    this.name = "AIStructuredError";
  }
}

export class AITimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`AI request timed out after ${timeoutMs}ms`);
    this.name = "AITimeoutError";
  }
}
