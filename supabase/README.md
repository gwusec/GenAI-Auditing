# Supabase backend (Phase 2 deliverable — not yet activated)

This folder holds the database schema and notes for the planned backend
persistence + auth (Feature 0). It is **designed but not wired to a live
project** — the app still runs on local IndexedDB until you activate this.

## What's here
- `migrations/0001_init.sql` — tables + Row-Level Security for the Feature 0
  data model: `profiles`, `studies`, `study_members` (per-study roles),
  `access_codes` (anonymous auditor entry), `conversations`, `message_reactions`
  (turn-level reactions).
- `migrations/0002_auth_glue.sql` — profile auto-provisioning + the
  `redeem_access_code` SECURITY DEFINER RPC for anonymous join.
- `migrations/0003_lifecycle_sessions_provenance.sql` — the "Phase E deltas"
  below, as real SQL: status vocabulary `draft|open|closed`, the redeem RPC's
  study-open gate, `auditor_sessions`, conversation provenance columns,
  write-side RLS membership checks, and the session helper RPCs. **Apply all
  three, in order** — the app cannot open a study against 0001/0002 alone.

## Data model in one breath
A **study** is owned by an investigator and carries its config (model, evaluation
methods, seed prompts, timers, image settings). **study_members** assigns
per-study roles, so one account can be investigator on study A and auditor on
study B. **Auditors** can join anonymously via an **access_code**. Conversations
and reactions belong to a study + auditor. **RLS** enforces: investigators read
all data in their studies; auditors read only their own.

## Activation (Phase 3)
1. Create a Supabase project (hosted) **or** run the self-host stack via the
   turnkey `docker-compose` (ships app + relay + Supabase together).
2. Apply the migration:
   ```bash
   supabase db push          # with the Supabase CLI, or
   psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql
   ```
3. Enable **Anonymous sign-ins** in Supabase Auth (for link/code auditors).
4. Set env vars for the frontend:
   ```bash
   REACT_APP_SUPABASE_URL=...
   REACT_APP_SUPABASE_ANON_KEY=...
   REACT_APP_PERSISTENCE=supabase     # flips the ConversationStore factory
   ```
5. `npm i @supabase/supabase-js` and finish `src/tools/stores/SupabaseStore.js`
   (the method bodies are stubbed with the intended queries in comments).

## Phase E migration deltas (implied by Phase B)

> **STATUS: implemented** — these deltas now exist as
> `migrations/0003_lifecycle_sessions_provenance.sql` (2026-07-03 audit-fix
> session). The list below is kept as the design rationale.

- **`studies.status` vocabulary →** `draft | open | closed` (rename the existing `active`
  → `open`). Update the check constraint. Lifecycle lives on this column (not in the
  config blob).
- **`redeem_access_code` RPC →** add a guard that **refuses unless the study's `status`
  is `open`** (SC-11). The app-layer mock already enforces this; the SQL RPC is the
  authoritative gate for anonymous redeemers.
- **New `auditor_sessions` table** (groups an auditor's N conversations; see
  `src/tools/sessions/`): `id`, `study_id` (fk), `auditor_id` (fk, nullable = anonymous),
  `config_version int`, `expected_conversations int`, `completed_conversations int default 0`,
  `status text check (status in ('in_progress','complete'))`, `consent jsonb`,
  `launch_metadata jsonb`, `created_at`. RLS: the owning auditor + the study's
  investigators can read; the auditor can update only their own session.
- **`conversations` provenance columns** (PRD §9 D9): `session_id` (fk →
  `auditor_sessions`), `control_mode text`, `seed_or_first_turn_text text`,
  `model_config_id text`, `model_config_version int`, `config_version int`. These make
  the per-conversation condition explicit and exportable (DASH-4).
- **Optional helper RPCs** referenced by `SupabaseSessionService`
  (`attach_conversation_to_session`, `complete_session_conversation`) — or fold these into
  `conversations.session_id` + a counter trigger; decide at activation.

## Still open (decide before activation)
- **Anonymous code redemption** needs a `SECURITY DEFINER` RPC (so an anonymous
  user can look up a study by code without broad table access) — to be added.
- **SMTP** for account verification + invites on self-host.
- **Consent notice** copy for the hosted beta (see PLAN.md — real studies are
  steered to self-host).
- Decide whether the **relay** also moves into Supabase Edge Functions or stays
  as the Express `server/server.js`.
