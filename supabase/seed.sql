-- Seed for REFERENCE/CONFIG tables only. Never contains user data.
-- Safe to run repeatedly (upserts).

insert into public.life_areas (id, label, sort_order) values
  ('health','Health',10),
  ('fitness','Fitness',20),
  ('nutrition','Nutrition',30),
  ('running','Running',40),
  ('learning','Learning & skills',50),
  ('career','Career',60),
  ('business','Business',70),
  ('finance','Finance',80),
  ('relationships','Relationships',90),
  ('family','Family',100),
  ('confidence','Confidence',110),
  ('discipline','Discipline',120),
  ('mental_wellbeing','Mental wellbeing',130),
  ('creativity','Creativity',140),
  ('home','Home & environment',150),
  ('social','Social life',160),
  ('organisation','Personal organisation',170),
  ('other','Something else',999)
on conflict (id) do update set label = excluded.label, sort_order = excluded.sort_order;

insert into public.chapters (id, slug, title, narrative, sort_order) values
  (1,'awakening','The Awakening','You noticed something has to change. That noticing is where every journey begins.',1),
  (2,'decision','The Decision','Wanting is not the same as choosing. Here, you choose — and name who you are becoming.',2),
  (3,'first-steps','The First Steps','No leaps. Just the first small, honest moves — repeated until they hold weight.',3),
  (4,'resistance','Resistance','Momentum meets friction. This chapter is about returning, not being perfect.',4)
on conflict (id) do update set title = excluded.title, narrative = excluded.narrative;

insert into public.prompt_versions (id, role, body, active) values
  ('future_you.v1','future_you','See src/lib/ai/prompts/future-you.ts — body mirrored here for audit.',true)
on conflict (id) do update set active = excluded.active;

insert into public.model_configurations
  (id, provider, model, input_price_per_mtok, output_price_per_mtok, active) values
  ('mock-default','mock','mock-1',0,0,true)
on conflict (id) do update set active = excluded.active;

-- A few validated, deliberately gentle mission templates (real ones per module
-- arrive in Phase 2/3). Difficulty starts 'gentle' — we never punish a miss.
insert into public.mission_templates
  (id, domain, title, description, mission_type, difficulty, estimated_minutes, base_xp, safety_category) values
  ('general.reflect_2min','other','Two honest minutes','Write two sentences about today — no performance, just truth.','reflection','gentle',2,12,null),
  ('health.walk_10','health','A 10-minute walk','A short walk. Movement counts even when it feels small.','primary','gentle',10,20,'exercise'),
  ('running.easy_walk_run','running','Easy walk/run','Alternate 1 min easy jog, 2 min walk, repeated gently.','primary','gentle',20,20,'exercise_progression'),
  ('learning.focus_15','learning','15 focused minutes','One small block of deliberate practice, distractions away.','primary','gentle',15,20,null)
on conflict (id) do update set title = excluded.title;
