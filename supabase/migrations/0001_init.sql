-- ============================================================================
-- Project Phoenix — 0001_init
-- Core schema + Row Level Security. UUID PKs, UTC timestamps.
--
-- Security model:
--   * Every user-owned table has RLS ENABLED and default-deny.
--   * Access is scoped by `user_id = auth.uid()` — the client-provided id is
--     never trusted.
--   * Reference/config tables are read-only to authenticated users and written
--     only by the service role (which bypasses RLS).
--   * The service-role key is used ONLY on the server, never shipped to a client.
--
-- Remaining tables from the full spec (weekly_reviews, memory_summaries,
-- developer_test_*, etc.) are added in later phases alongside their features.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type goal_domain as enum (
  'health','fitness','nutrition','running','learning','career','business',
  'finance','relationships','family','confidence','discipline','mental_wellbeing',
  'creativity','home','social','organisation','other'
);
create type dream_or_goal as enum ('dream','vision','goal','milestone','identity');
create type goal_status as enum ('draft','proposed','active','paused','achieved','archived');
create type approval_status as enum ('pending','approved','rejected','edited');
create type realism_assessment as enum ('realistic','ambitious','unclear','unrealistic_timeframe','unsafe');
create type mission_type as enum ('primary','maintenance','courage','recovery','reflection');
create type mission_difficulty as enum ('gentle','moderate','stretch');
create type mission_result_status as enum ('completed','partial','skipped','postponed');
create type safety_severity as enum ('none','elevated','crisis');
create type subscription_tier as enum ('free','phoenix','phoenix_plus');

-- ===========================================================================
-- IDENTITY
-- ===========================================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  locale text not null default 'en',
  timezone text not null default 'UTC',
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.future_self_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Future You',
  identity_traits text[] not null default '{}',
  values text[] not null default '{}',
  long_term_dream text,
  communication_style text not null default 'A balanced mix',
  intensity jsonb not null default '{"encouragement":3,"directness":3,"accountability":3,"detail":3}',
  reason_for_starting text,
  personal_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.future_self_profiles(user_id);

create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ai_memory_enabled boolean not null default true,
  theme text not null default 'dark',
  reduced_motion boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_boundaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text not null,
  -- 'avoid' = never raise; 'careful' = handle gently; also controls AI memory.
  handling text not null default 'careful',
  exclude_from_ai_memory boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, topic)
);
create index on public.user_boundaries(user_id);

-- ===========================================================================
-- ONBOARDING (save + resume)
-- ===========================================================================
create table public.onboarding_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  current_step text not null default 'intro',
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.onboarding_sessions(user_id);

create table public.onboarding_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.onboarding_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  step text not null,
  answer jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, step)
);
create index on public.onboarding_answers(user_id);

-- ===========================================================================
-- GOAL ENGINE
-- ===========================================================================
-- Reference table (read-only to users).
create table public.life_areas (
  id text primary key,           -- e.g. 'health','finance'
  label text not null,
  sort_order int not null default 0
);

create table public.user_focus_areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  life_area_id text not null references public.life_areas(id),
  priority int not null default 0,   -- 0 = primary focus
  created_at timestamptz not null default now(),
  unique (user_id, life_area_id)
);
create index on public.user_focus_areas(user_id);

create table public.dreams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.dreams(user_id);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- realism contract: the dream stays linked and visible alongside the goal.
  dream_id uuid references public.dreams(id) on delete set null,
  raw_input text not null,
  display_title text not null,
  description text,
  domain goal_domain not null default 'other',
  goal_type text,
  dream_or_goal dream_or_goal not null default 'goal',
  current_state text,
  target_state text,
  target_date date,
  time_horizon text,
  priority int not null default 0,
  motivation text,
  realism realism_assessment,
  status goal_status not null default 'draft',
  approval_status approval_status not null default 'pending',
  -- flexible, non-queryable extras only (safety flags are structured below).
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.goals(user_id);
create index on public.goals(user_id, status);

create table public.goal_constraints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  -- 'health','time','injury','dietary','medical','financial',...
  kind text not null,
  detail text not null,
  created_at timestamptz not null default now()
);
create index on public.goal_constraints(goal_id);

create table public.goal_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  label text not null,
  unit text,
  baseline numeric,
  target numeric,
  current numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.goal_metrics(goal_id);

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  title text not null,
  description text,
  target_date date,
  achieved_at timestamptz,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.milestones(goal_id);

-- ===========================================================================
-- DAILY LOOP
-- ===========================================================================
-- Reference table of validated mission templates (read-only to users).
create table public.mission_templates (
  id text primary key,
  domain goal_domain not null,
  title text not null,
  description text,
  mission_type mission_type not null default 'primary',
  difficulty mission_difficulty not null default 'gentle',
  estimated_minutes int not null default 10,
  base_xp int not null default 20,
  safety_category text,
  created_at timestamptz not null default now()
);

create table public.missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid references public.goals(id) on delete set null,
  template_id text references public.mission_templates(id),
  title text not null,
  description text,
  focus_area text,
  mission_type mission_type not null default 'primary',
  reason text,
  estimated_minutes int not null default 10,
  difficulty mission_difficulty not null default 'gentle',
  xp int not null default 20,
  completion_method text not null default 'check',
  safety_category text,
  approval_status approval_status not null default 'approved',
  scheduled_for date not null default (now() at time zone 'utc')::date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.missions(user_id, scheduled_for);

create table public.mission_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mission_id uuid not null references public.missions(id) on delete cascade,
  status mission_result_status not null,
  note text,
  duration_minutes int,
  quantity numeric,
  created_at timestamptz not null default now()
);
create index on public.mission_results(user_id, created_at);

create table public.mood_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- ALWAYS user-selected. There is no code path where the AI writes this.
  mood text not null,
  energy int, -- 1..5, user-selected
  created_at timestamptz not null default now()
);
create index on public.mood_entries(user_id, created_at);

create table public.daily_check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  check_in_date date not null default (now() at time zone 'utc')::date,
  created_at timestamptz not null default now(),
  unique (user_id, check_in_date)
);

create table public.reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  mood_entry_id uuid references public.mood_entries(id) on delete set null,
  -- user can exclude any reflection from AI memory.
  exclude_from_ai_memory boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.reflections(user_id, created_at);

-- ===========================================================================
-- AI
-- ===========================================================================
create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'future_you', -- 'future_you' | 'reflection' | ...
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.ai_conversations(user_id);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('system','user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index on public.ai_messages(conversation_id, created_at);

-- Usage/cost logging. NEVER stores prompt/response content.
create table public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  model text not null,
  prompt_version text,
  workflow text not null,           -- 'goal_classify' | 'future_you' | ...
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  latency_ms int not null default 0,
  estimated_cost_usd numeric(10,6) not null default 0,
  had_error boolean not null default false,
  error_code text,                  -- code only, no sensitive content
  created_at timestamptz not null default now()
);
create index on public.ai_usage_events(user_id, created_at);

-- Reference/config (read-only to users).
create table public.prompt_versions (
  id text primary key,              -- e.g. 'future_you.v1'
  role text not null,               -- 'future_you' | 'goal_classify' | ...
  body text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.model_configurations (
  id text primary key,              -- e.g. 'qwen3-32b-default'
  provider text not null,
  model text not null,
  input_price_per_mtok numeric(10,4) not null default 0,
  output_price_per_mtok numeric(10,4) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ===========================================================================
-- PROGRESSION
-- ===========================================================================
create table public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,         -- 'onboarding_started','goal_created',...
  summary text not null,
  goal_id uuid references public.goals(id) on delete set null,
  tags text[] not null default '{}',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index on public.timeline_events(user_id, occurred_at);
create index on public.timeline_events using gin (tags);

create table public.character_attributes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- discipline, health, courage, focus, resilience, knowledge, stability, connection
  attribute text not null,
  value numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, attribute)
);
create index on public.character_attributes(user_id);

create table public.attribute_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  attribute text not null,
  delta numeric not null,
  reason text not null,
  created_at timestamptz not null default now()
);
create index on public.attribute_events(user_id, created_at);

create table public.xp_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount int not null,
  reason text not null,
  created_at timestamptz not null default now()
);
create index on public.xp_transactions(user_id, created_at);

-- Reference table (read-only to users).
create table public.chapters (
  id int primary key,
  slug text not null unique,
  title text not null,
  narrative text not null,
  sort_order int not null
);

create table public.user_chapter_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter_id int not null references public.chapters(id),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, chapter_id)
);
create index on public.user_chapter_progress(user_id);

-- ===========================================================================
-- SAFETY / OPS
-- ===========================================================================
-- Minimal by design: stores only what's needed to review safety handling.
create table public.safety_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  severity safety_severity not null,
  categories text[] not null default '{}',
  surface text not null,            -- 'reflection' | 'future_you' | 'goal' ...
  ai_blocked boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.safety_events(user_id, created_at);

create table public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier subscription_tier not null default 'free',
  status text not null default 'active',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  morning_time time,
  evening_time time,
  days int[] not null default '{1,2,3,4,5,6,7}',
  quiet_hours_start time,
  quiet_hours_end time,
  tone text not null default 'gentle',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===========================================================================
-- updated_at triggers
-- ===========================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','future_self_profiles','user_preferences','onboarding_sessions',
    'onboarding_answers','dreams','goals','goal_metrics','milestones','missions',
    'reflections','ai_conversations','character_attributes','subscriptions',
    'notification_preferences'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at();', t);
  end loop;
end $$;

-- ===========================================================================
-- ROW LEVEL SECURITY
-- ===========================================================================
-- Enable RLS + owner policy on every user-owned table.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','future_self_profiles','user_preferences','user_boundaries',
    'onboarding_sessions','onboarding_answers','user_focus_areas','dreams',
    'goals','goal_constraints','goal_metrics','milestones','missions',
    'mission_results','mood_entries','daily_check_ins','reflections',
    'ai_conversations','ai_messages','ai_usage_events','timeline_events',
    'character_attributes','attribute_events','xp_transactions',
    'user_chapter_progress','safety_events','subscriptions',
    'notification_preferences'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    -- profiles keys on id; every other table keys on user_id.
    if t = 'profiles' then
      execute format($p$
        create policy "own_rows" on public.%I
          for all to authenticated
          using (id = auth.uid())
          with check (id = auth.uid());$p$, t);
    else
      execute format($p$
        create policy "own_rows" on public.%I
          for all to authenticated
          using (user_id = auth.uid())
          with check (user_id = auth.uid());$p$, t);
    end if;
  end loop;
end $$;

-- Reference/config tables: readable by any authenticated user, writable only
-- by the service role (which bypasses RLS entirely).
do $$
declare t text;
begin
  foreach t in array array[
    'life_areas','mission_templates','prompt_versions','model_configurations','chapters'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format($p$
      create policy "read_all_auth" on public.%I
        for select to authenticated using (true);$p$, t);
  end loop;
end $$;
