-- ============================================================================
-- 0003_weekly_reviews
-- Stores each generated weekly review. Stats are computed deterministically by
-- the app; interpretation is the AI's reading of those stats. Adjustments are
-- proposals only — applying them requires explicit user action elsewhere.
-- ============================================================================

create table public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  stats jsonb not null default '{}',
  interpretation jsonb not null default '{}',
  source text not null default 'ai', -- 'ai' | 'fallback'
  created_at timestamptz not null default now(),
  unique (user_id, period_start)
);
create index on public.weekly_reviews(user_id, period_start desc);

alter table public.weekly_reviews enable row level security;
create policy "own_rows" on public.weekly_reviews
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
