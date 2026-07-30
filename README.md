# Project Phoenix

> Become the person you promised yourself you would become.

A gamified personal-transformation app guided by a **simulated future self** —
grounded, honest, and safe. It never claims to know your future or guarantees
outcomes; it helps you focus on what is in your control today.

This repo is being built in phases. **Phase 1 (foundation) is complete.**

## Architecture principles

- **The app owns truth, the AI owns language.** XP, streaks/consistency,
  mission validation, safety, timeline facts, and all calculations are
  deterministic application logic. The AI only understands, writes, reflects,
  and interprets — it can never invent facts or decide a mission is "safe."
- **Provider-independent AI.** Product code depends only on the `AIProvider`
  interface (`src/lib/ai/types.ts`). Swapping Qwen → OpenAI/Anthropic/Groq/etc.
  is an env change, not a code change. A zero-cost `MockProvider` runs the whole
  app with no API key.
- **Safety is code, not a prompt.** `src/lib/safety` screens input before any AI
  call; crisis input bypasses the AI and the game entirely (no XP, static
  resource card). AI output is screened again afterwards.
- **Grounded citations.** The Future You response schema only lets the AI cite
  timeline-event IDs that were actually supplied — invented IDs are dropped.
- **Cross-platform from day one.** Same Next.js codebase targets web, PWA, and
  Capacitor (Android/iOS). Native capabilities go behind `src/lib/platform/*`.

## Stack

Next.js 14 (App Router) · TypeScript (strict) · Tailwind + shadcn/ui · Supabase
(Auth/Postgres/RLS) · Zod · React Hook Form · TanStack Query · Vitest · Playwright.

## Getting started

```bash
npm install
cp .env.example .env.local   # works out-of-the-box with AI_PROVIDER=mock
npm run dev
```

Quality gates:

```bash
npm run typecheck   # tsc --noEmit (strict, noUncheckedIndexedAccess)
npm run lint        # next lint
npm test            # vitest — 16 unit tests (xp, consistency, safety, AI schemas)
npm run build       # production build
```

## Supabase setup

1. Create a project at supabase.com and copy the URL + anon + service-role keys
   into `.env.local` (service-role is **server-only** — never `NEXT_PUBLIC_*`).
2. Apply the schema and seed:
   ```bash
   # via Supabase SQL editor, or the CLI:
   supabase db execute --file supabase/migrations/0001_init.sql
   supabase db execute --file supabase/seed.sql
   ```
3. Every user-owned table has **RLS enabled, default-deny**, scoped by
   `auth.uid()`. Reference/config tables are read-only to authenticated users.

## Switching to a real AI provider (e.g. hosted Qwen)

Set in `.env.local` — nothing about the vendor is hard-coded:

```bash
AI_PROVIDER=openai-compatible
AI_BASE_URL=https://your-provider.example/v1
AI_API_KEY=sk-...
AI_MODEL=qwen3-32b
```

Works with any OpenAI-compatible host (Qwen, OpenAI, Groq, OpenRouter, Together,
Fireworks, Mistral). If keys are missing, the app safely falls back to Mock.

## Mobile (Capacitor) — planned Phase 5

The app avoids browser-only assumptions and routes native features through
`src/lib/platform/*` so Capacitor packaging stays straightforward. Android/iOS
project generation and the static-export profile are documented and wired in
Phase 5. No React Native rebuild required — the web app *is* the mobile app.

## Project layout

```
src/
  app/            routes (public / app / onboarding / dev)
  lib/
    ai/           provider interface, providers, versioned prompts, Zod schemas
    safety/       deterministic pre/post filters + crisis resources
    domain/       xp, consistency (pure, tested)  ← app-owned truth
  env.ts          zod-validated env (server/client split)
supabase/
  migrations/     0001_init.sql (schema + RLS)
  seed.sql        reference/config data only
tests/unit/       vitest
```

## Status

| Phase | Scope | State |
|-------|-------|-------|
| 0 | Product & architecture review | ✅ Done |
| 1 | Foundation (project, AI arch, safety, domain logic, schema+RLS, landing, PWA/Capacitor groundwork) | ✅ Done |
| 2 | Onboarding + goal engine | ⏭ Next |
| 3 | Daily loop (missions, reflection, Future You) | ⏳ |
| 4 | Progression (XP, attributes, chapters, timeline, weekly review) | ⏳ |
| 5 | Privacy, offline, notifications, Capacitor builds | ⏳ |
| 6 | AI lab, safety tests, e2e, a11y, perf | ⏳ |

**Not medical or therapy software.** Phoenix is informational and points to real
human/professional help where appropriate.
