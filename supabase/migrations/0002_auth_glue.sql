-- TRAILS Chatbot — auth glue (apply AFTER 0001_init.sql).
-- Two things the app needs that the base schema doesn't cover:
--   1. auto-create a public.profiles row when a user signs up (incl. anonymous)
--   2. a SECURITY DEFINER RPC so an (anonymous) auditor can redeem an access code
--      without being able to read the access_codes table directly.

-- ---------------------------------------------------------------------------
-- 1) Profile auto-provisioning from auth.users
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, is_anonymous)
  values (new.id, new.email, coalesce(new.is_anonymous, false))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- keep email / is_anonymous in sync when an anonymous user upgrades to an account
create or replace function public.sync_profile_from_auth()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
     set email = new.email,
         is_anonymous = coalesce(new.is_anonymous, false)
   where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update on auth.users
  for each row execute function public.sync_profile_from_auth();

-- ---------------------------------------------------------------------------
-- 2) Anonymous-safe access-code redemption
--    (access_codes RLS is investigator-only; this runs as definer to validate
--     and enroll the caller as an auditor.)
--    NOTE: codes are compared upper-cased — store codes upper-case on creation.
-- ---------------------------------------------------------------------------
create or replace function public.redeem_access_code(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_code public.access_codes;
  v_uid  uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_code
    from public.access_codes
   where code = upper(p_code)
   for update;

  if not found then
    raise exception 'Invalid access code';
  end if;
  if v_code.expires_at is not null and now() > v_code.expires_at then
    raise exception 'This access code has expired';
  end if;
  if v_code.max_uses is not null and v_code.uses >= v_code.max_uses then
    raise exception 'This access code has reached its use limit';
  end if;

  update public.access_codes set uses = uses + 1 where id = v_code.id;

  insert into public.study_members (study_id, user_id, role)
  values (v_code.study_id, v_uid, 'auditor')
  on conflict (study_id, user_id, role) do nothing;

  return v_code.study_id;
end;
$$;

grant execute on function public.redeem_access_code(text) to anon, authenticated;

-- Optional convenience: default conversation ownership to the caller, so the
-- client doesn't have to set auditor_id explicitly (RLS still enforces it).
alter table public.conversations
  alter column auditor_id set default auth.uid();
