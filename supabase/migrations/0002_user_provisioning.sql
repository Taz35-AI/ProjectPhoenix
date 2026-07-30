-- ============================================================================
-- 0002_user_provisioning
-- Auto-provision the baseline rows a new user needs, in a single trigger that
-- runs with definer rights (bypasses RLS for the insert). This keeps signup
-- atomic and means the app never has to create these rows client-side.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1))
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.subscriptions (user_id, tier, status)
  values (new.id, 'free', 'active')
  on conflict (user_id) do nothing;

  insert into public.future_self_profiles (user_id)
  values (new.id);

  -- Seed the eight character attributes at zero.
  insert into public.character_attributes (user_id, attribute, value)
  select new.id, a, 0
  from unnest(array[
    'discipline','health','courage','focus','resilience','knowledge','stability','connection'
  ]) as a
  on conflict (user_id, attribute) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
