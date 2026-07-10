-- TRAILS Chatbot — Supabase schema (Feature 0 backbone + conversations).
-- Phase 2 deliverable. NOT YET APPLIED — review, then run against a Supabase
-- project (or the self-host stack). Designed for Postgres + Supabase Auth + RLS.
--
-- Roles are PER-STUDY (a user can be investigator on one study and auditor on
-- another). Auditors may be anonymous (Supabase anonymous sign-in). Row-Level
-- Security enforces isolation: investigators see only their studies' data;
-- auditors see only their own.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles — application-level user row, 1:1 with auth.users
-- (auth.users is managed by Supabase Auth; anonymous users get a row too)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  display_name text,
  is_anonymous boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- studies — created/owned by an investigator. `config` holds the study setup
-- (chosen model(s), evaluation methods/SurveyJS JSON, seed prompts, timers,
-- image settings, consent text, etc.) — the "feature zero" object.
-- ---------------------------------------------------------------------------
create table if not exists public.studies (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  description text,
  config      jsonb not null default '{}'::jsonb,
  status      text not null default 'draft' check (status in ('draft','active','closed')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- study_members — per-study role assignments (the dual-role mechanism)
-- ---------------------------------------------------------------------------
create table if not exists public.study_members (
  id         uuid primary key default gen_random_uuid(),
  study_id   uuid not null references public.studies(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       text not null check (role in ('investigator','auditor')),
  created_at timestamptz not null default now(),
  unique (study_id, user_id, role)
);

-- ---------------------------------------------------------------------------
-- access_codes — anonymous auditor entry to a study via link/code
-- ---------------------------------------------------------------------------
create table if not exists public.access_codes (
  id         uuid primary key default gen_random_uuid(),
  study_id   uuid not null references public.studies(id) on delete cascade,
  code       text not null unique,
  max_uses   integer,                 -- null = unlimited
  uses       integer not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- conversations — mirrors the in-app Conversation object (event-sourced).
-- chat_events + audit are stored as jsonb to match the current data model.
-- ---------------------------------------------------------------------------
create table if not exists public.conversations (
  id              uuid primary key default gen_random_uuid(),
  study_id        uuid not null references public.studies(id) on delete cascade,
  auditor_id      uuid references public.profiles(id) on delete set null,
  state           text not null default 'chat',
  chat_events     jsonb not null default '[]'::jsonb,
  audit           jsonb not null default '{}'::jsonb,
  start_timestamp bigint,
  end_timestamp   bigint,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists conversations_study_idx on public.conversations(study_id);
create index if not exists conversations_auditor_idx on public.conversations(auditor_id);

-- ---------------------------------------------------------------------------
-- message_reactions — turn-level reactions (thumbs/star/flag/comment) — a
-- locked v1 feature, modeled now. One row per reaction on a message.
-- ---------------------------------------------------------------------------
create table if not exists public.message_reactions (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  message_id      text not null,       -- the in-event message id
  auditor_id      uuid references public.profiles(id) on delete set null,
  kind            text not null check (kind in ('thumbs_up','thumbs_down','star','flag','comment')),
  value           jsonb,               -- e.g. { "text": "..." } for comments
  created_at      timestamptz not null default now()
);
create index if not exists reactions_conversation_idx on public.message_reactions(conversation_id);

-- ===========================================================================
-- Helper functions (SECURITY DEFINER to avoid recursive RLS evaluation)
-- ===========================================================================
create or replace function public.is_study_investigator(p_study uuid, p_user uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.studies s where s.id = p_study and s.owner_id = p_user
  ) or exists (
    select 1 from public.study_members m
    where m.study_id = p_study and m.user_id = p_user and m.role = 'investigator'
  );
$$;

create or replace function public.is_study_member(p_study uuid, p_user uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.study_members m
    where m.study_id = p_study and m.user_id = p_user
  ) or public.is_study_investigator(p_study, p_user);
$$;

-- ===========================================================================
-- Row-Level Security
-- ===========================================================================
alter table public.profiles          enable row level security;
alter table public.studies           enable row level security;
alter table public.study_members     enable row level security;
alter table public.access_codes      enable row level security;
alter table public.conversations     enable row level security;
alter table public.message_reactions enable row level security;

-- profiles: a user manages only their own profile row
create policy profiles_self_select on public.profiles
  for select using (id = auth.uid());
create policy profiles_self_upsert on public.profiles
  for insert with check (id = auth.uid());
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid());

-- studies: owner has full control; members can read studies they belong to
create policy studies_owner_all on public.studies
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy studies_member_select on public.studies
  for select using (public.is_study_member(id, auth.uid()));

-- study_members: study investigators manage rows; users can see their own
create policy members_investigator_all on public.study_members
  for all using (public.is_study_investigator(study_id, auth.uid()))
  with check (public.is_study_investigator(study_id, auth.uid()));
create policy members_self_select on public.study_members
  for select using (user_id = auth.uid());

-- access_codes: only investigators of the study manage/see codes
-- (anonymous redemption of a code happens via a SECURITY DEFINER RPC in Phase 3,
--  so this table itself stays investigator-only)
create policy codes_investigator_all on public.access_codes
  for all using (public.is_study_investigator(study_id, auth.uid()))
  with check (public.is_study_investigator(study_id, auth.uid()));

-- conversations: auditor owns their own; study investigators can read all
create policy conversations_auditor_all on public.conversations
  for all using (auditor_id = auth.uid()) with check (auditor_id = auth.uid());
create policy conversations_investigator_select on public.conversations
  for select using (public.is_study_investigator(study_id, auth.uid()));

-- message_reactions: auditor owns their own; study investigators can read all
create policy reactions_auditor_all on public.message_reactions
  for all using (auditor_id = auth.uid()) with check (auditor_id = auth.uid());
create policy reactions_investigator_select on public.message_reactions
  for select using (
    public.is_study_investigator(
      (select c.study_id from public.conversations c where c.id = conversation_id),
      auth.uid()
    )
  );

-- ===========================================================================
-- updated_at trigger
-- ===========================================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger studies_touch before update on public.studies
  for each row execute function public.touch_updated_at();
create trigger conversations_touch before update on public.conversations
  for each row execute function public.touch_updated_at();
