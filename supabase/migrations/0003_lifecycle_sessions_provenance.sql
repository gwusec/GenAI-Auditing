-- TRAILS Chatbot — 0003: lifecycle vocabulary, session model, provenance, RLS
-- tightening. Apply AFTER 0001_init.sql and 0002_auth_glue.sql.
--
-- This is the "Phase E migration deltas" block from supabase/README.md turned
-- into real SQL. Without it the app cannot open a study against 0001 (the app
-- writes status='open'; 0001's check constraint only allows 'active'), and
-- SupabaseSessionService targets tables/RPCs that don't exist.

-- ---------------------------------------------------------------------------
-- 1) studies.status vocabulary: draft | open | closed  (was: draft|active|closed)
--    The app (schema.js LIFECYCLE_STATES, SupabaseStudyService.openStudy) uses
--    'open'. Migrate any existing 'active' rows, then swap the constraint.
-- ---------------------------------------------------------------------------
alter table public.studies drop constraint if exists studies_status_check;
update public.studies set status = 'open' where status = 'active';
alter table public.studies
  add constraint studies_status_check check (status in ('draft','open','closed'));

-- ---------------------------------------------------------------------------
-- 2) redeem_access_code: refuse unless the study is OPEN (SC-11).
--    The SQL RPC is the authoritative gate for anonymous redeemers — the app
--    layer cannot be trusted to enforce this.
-- ---------------------------------------------------------------------------
create or replace function public.redeem_access_code(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_code   public.access_codes;
  v_status text;
  v_uid    uuid := auth.uid();
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

  select s.status into v_status from public.studies s where s.id = v_code.study_id;
  if v_status is distinct from 'open' then
    raise exception 'This study is not currently open to auditors';
  end if;

  update public.access_codes set uses = uses + 1 where id = v_code.id;

  insert into public.study_members (study_id, user_id, role)
  values (v_code.study_id, v_uid, 'auditor')
  on conflict (study_id, user_id, role) do nothing;

  return v_code.study_id;
end;
$$;

grant execute on function public.redeem_access_code(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) auditor_sessions — groups an auditor's N conversations in one study run
--    (consent record, launch metadata, progress). Matches
--    src/tools/sessions/SupabaseSessionService.js.
-- ---------------------------------------------------------------------------
create table if not exists public.auditor_sessions (
  id                      uuid primary key default gen_random_uuid(),
  study_id                uuid not null references public.studies(id) on delete cascade,
  auditor_id              uuid references public.profiles(id) on delete set null default auth.uid(),
  config_version          integer,
  expected_conversations  integer,
  completed_conversations integer not null default 0,
  conversation_ids        uuid[] not null default '{}',
  status                  text not null default 'in_progress'
                          check (status in ('in_progress','complete')),
  consent                 jsonb,
  launch_metadata         jsonb,
  created_at              timestamptz not null default now()
);
create index if not exists sessions_study_idx   on public.auditor_sessions(study_id);
create index if not exists sessions_auditor_idx on public.auditor_sessions(auditor_id);

alter table public.auditor_sessions enable row level security;

-- the owning auditor manages their own session — and only inside a study they
-- are actually a member of (write-side isolation)
drop policy if exists sessions_auditor_all on public.auditor_sessions;
create policy sessions_auditor_all on public.auditor_sessions
  for all using (auditor_id = auth.uid())
  with check (auditor_id = auth.uid()
              and public.is_study_member(study_id, auth.uid()));

-- the study's investigators can read all sessions in their study
drop policy if exists sessions_investigator_select on public.auditor_sessions;
create policy sessions_investigator_select on public.auditor_sessions
  for select using (public.is_study_investigator(study_id, auth.uid()));

-- ---------------------------------------------------------------------------
-- 4) conversations — session link + provenance columns (PRD §9 D9), so every
--    conversation carries the exact condition it ran under and exports can
--    stratify without unpacking jsonb.
-- ---------------------------------------------------------------------------
alter table public.conversations
  add column if not exists session_id             uuid references public.auditor_sessions(id) on delete set null,
  add column if not exists control_mode           text,
  add column if not exists seed_or_first_turn_text text,
  add column if not exists model_config_id        text,
  add column if not exists model_config_version   integer,
  add column if not exists config_version         integer;
create index if not exists conversations_session_idx on public.conversations(session_id);

-- ---------------------------------------------------------------------------
-- 5) RLS tightening (write-side isolation): an authenticated user could
--    previously INSERT conversations/reactions pointing at ANY study_id they
--    learned. Require membership of the target study on writes.
--    (Read isolation was already correct.)
-- ---------------------------------------------------------------------------
drop policy if exists conversations_auditor_all on public.conversations;
create policy conversations_auditor_all on public.conversations
  for all using (auditor_id = auth.uid())
  with check (auditor_id = auth.uid()
              and public.is_study_member(study_id, auth.uid()));

drop policy if exists reactions_auditor_all on public.message_reactions;
create policy reactions_auditor_all on public.message_reactions
  for all using (auditor_id = auth.uid())
  with check (
    auditor_id = auth.uid()
    and public.is_study_member(
      (select c.study_id from public.conversations c where c.id = conversation_id),
      auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 6) Session helper RPCs used by SupabaseSessionService. SECURITY DEFINER with
--    an explicit ownership check (the definer bypasses RLS).
-- ---------------------------------------------------------------------------
create or replace function public.attach_conversation_to_session(
  p_session_id uuid, p_conversation_id uuid)
returns public.auditor_sessions
language plpgsql security definer set search_path = public as $$
declare
  v_session public.auditor_sessions;
begin
  select * into v_session from public.auditor_sessions
   where id = p_session_id and auditor_id = auth.uid()
   for update;
  if not found then
    raise exception 'Session not found or not yours';
  end if;

  update public.conversations
     set session_id = p_session_id
   where id = p_conversation_id and auditor_id = auth.uid();
  if not found then
    raise exception 'Conversation not found or not yours';
  end if;

  update public.auditor_sessions
     set conversation_ids = array_append(conversation_ids, p_conversation_id)
   where id = p_session_id
     and not (conversation_ids @> array[p_conversation_id])
  returning * into v_session;
  if v_session.id is null then
    select * into v_session from public.auditor_sessions where id = p_session_id;
  end if;

  return v_session;
end;
$$;

create or replace function public.complete_session_conversation(p_session_id uuid)
returns public.auditor_sessions
language plpgsql security definer set search_path = public as $$
declare
  v_session public.auditor_sessions;
begin
  update public.auditor_sessions
     set completed_conversations = completed_conversations + 1
   where id = p_session_id and auditor_id = auth.uid()
  returning * into v_session;
  if not found then
    raise exception 'Session not found or not yours';
  end if;

  if v_session.expected_conversations is not null
     and v_session.completed_conversations >= v_session.expected_conversations then
    update public.auditor_sessions set status = 'complete'
     where id = p_session_id
    returning * into v_session;
  end if;

  return v_session;
end;
$$;

grant execute on function public.attach_conversation_to_session(uuid, uuid) to authenticated;
grant execute on function public.complete_session_conversation(uuid) to authenticated;
