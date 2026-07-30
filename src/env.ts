import { z } from "zod";

/**
 * Central, validated environment access. Fails fast at startup with a clear
 * message rather than surfacing `undefined` deep in a request.
 *
 * SECURITY: only NEXT_PUBLIC_* values may ever reach the client. Supabase
 * service-role and AI keys are server-only and are read lazily so that
 * importing this module in a client bundle does not throw.
 */

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  // AI — provider-independent. Nothing here names Qwen; that is config, not code.
  AI_PROVIDER: z.enum(["mock", "openai-compatible"]).default("mock"),
  AI_BASE_URL: z.string().url().optional(),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default("mock-1"),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  AI_MAX_INPUT_TOKENS: z.coerce.number().int().positive().default(6_000),
  AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(700),
  AI_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.6),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

function format(name: string, error: z.ZodError): never {
  const issues = error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Invalid ${name} environment variables:\n${issues}`);
}

let _server: z.infer<typeof serverSchema> | null = null;
export function serverEnv() {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() must not be called on the client.");
  }
  if (_server) return _server;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) format("server", parsed.error);
  _server = parsed.data;
  return _server;
}

let _client: z.infer<typeof clientSchema> | null = null;
export function clientEnv() {
  if (_client) return _client;
  // Next inlines NEXT_PUBLIC_* at build time; reference them explicitly.
  const parsed = clientSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });
  if (!parsed.success) format("client", parsed.error);
  _client = parsed.data;
  return _client;
}
