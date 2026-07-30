import type { z } from "zod";
import {
  type AIProvider,
  type AIStructuredRequest,
  type AITextRequest,
  type AITextResponse,
  type AIUsage,
  AIStructuredError,
  AITimeoutError,
} from "../types";

/**
 * Works with any OpenAI-compatible chat-completions endpoint:
 * Qwen (hosted), OpenAI, Groq, OpenRouter, Together, Fireworks, Mistral, ...
 * Model/base-url/key all come from config — nothing hard-coded.
 */

export interface OpenAICompatibleConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxOutputTokens: number;
  temperature: number;
}

interface ChatCompletionResponse {
  choices: { message: { content: string | null }; finish_reason: string }[];
  usage?: { prompt_tokens: number; completion_tokens: number };
}

export class OpenAICompatibleProvider implements AIProvider {
  readonly id = "openai-compatible";
  constructor(private readonly config: OpenAICompatibleConfig) {}

  async generateText(request: AITextRequest): Promise<AITextResponse> {
    const started = Date.now();
    const messages = request.system
      ? [{ role: "system", content: request.system }, ...request.messages]
      : request.messages;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    let res: Response;
    try {
      res = await fetch(`${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          temperature: request.temperature ?? this.config.temperature,
          max_tokens: Math.min(
            request.maxOutputTokens ?? this.config.maxOutputTokens,
            this.config.maxOutputTokens,
          ),
        }),
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new AITimeoutError(this.config.timeoutMs);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      // Never log full body (may contain user content); truncate hard.
      throw new Error(`AI provider error ${res.status}: ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as ChatCompletionResponse;
    const choice = json.choices[0];
    const usage: AIUsage = {
      inputTokens: json.usage?.prompt_tokens ?? 0,
      outputTokens: json.usage?.completion_tokens ?? 0,
      latencyMs: Date.now() - started,
    };
    return {
      // Reasoning ("thinking") models such as Qwen3 may emit a <think> trace
      // inline; strip it so callers only ever see the final answer.
      text: stripThink(choice?.message.content ?? ""),
      usage,
      model: this.config.model,
      finishReason: normaliseFinish(choice?.finish_reason),
    };
  }

  async generateStructured<T>(
    request: AIStructuredRequest,
    schema: z.ZodSchema<T>,
  ): Promise<{ data: T; usage: AIUsage; model: string }> {
    const jsonInstruction =
      "\n\nReturn ONLY a single valid JSON object. No markdown, no code fences, no prose.";
    const first = await this.generateText({
      ...request,
      system: (request.system ?? "") + jsonInstruction,
      temperature: request.temperature ?? 0.2,
    });

    const parsedFirst = tryParse(first.text, schema);
    if (parsedFirst.ok) {
      return { data: parsedFirst.value, usage: first.usage, model: first.model };
    }

    // One repair attempt: show the model its own output + the failure.
    const repair = await this.generateText({
      ...request,
      system: (request.system ?? "") + jsonInstruction,
      messages: [
        ...request.messages,
        { role: "assistant", content: first.text.slice(0, 2000) },
        {
          role: "user",
          content:
            "That was not valid JSON for the required schema. Reply again with ONLY the corrected JSON object.",
        },
      ],
      temperature: 0,
    });

    const parsedSecond = tryParse(repair.text, schema);
    if (parsedSecond.ok) {
      const usage: AIUsage = {
        inputTokens: first.usage.inputTokens + repair.usage.inputTokens,
        outputTokens: first.usage.outputTokens + repair.usage.outputTokens,
        latencyMs: first.usage.latencyMs + repair.usage.latencyMs,
      };
      return { data: parsedSecond.value, usage, model: repair.model };
    }

    throw new AIStructuredError(
      "Structured output failed schema validation after one repair attempt.",
      repair.text,
      parsedSecond.issues,
    );
  }
}

/**
 * Remove a leading/inline chain-of-thought block that some reasoning models
 * (e.g. Qwen3) emit before the answer. We never surface reasoning to users.
 */
export function stripThink(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/^[\s\S]*?<\/think>/i, "").trim();
}

function normaliseFinish(reason: string | undefined): AITextResponse["finishReason"] {
  switch (reason) {
    case "stop":
      return "stop";
    case "length":
      return "length";
    case "content_filter":
      return "content_filter";
    default:
      return "unknown";
  }
}

function tryParse<T>(
  raw: string,
  schema: z.ZodSchema<T>,
): { ok: true; value: T } | { ok: false; issues: unknown } {
  const candidate = extractJson(raw);
  if (candidate === null) return { ok: false, issues: "no JSON object found" };
  let obj: unknown;
  try {
    obj = JSON.parse(candidate);
  } catch {
    return { ok: false, issues: "JSON.parse failed" };
  }
  const result = schema.safeParse(obj);
  return result.success ? { ok: true, value: result.data } : { ok: false, issues: result.error.issues };
}

/** Tolerant extraction: strips code fences / surrounding prose. */
function extractJson(raw: string): string | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const text = (fenced?.[1] ?? raw).trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  return text.slice(start, end + 1);
}
