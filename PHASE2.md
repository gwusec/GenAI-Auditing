# Phase 2 — Seams + Supabase (Execution Log)

> Goal: introduce the two abstraction boundaries every later feature depends on
> (LLM transport + persistence), and lay the Supabase backend — **without changing
> current behavior** (app still runs on the relay + local IndexedDB).
> Constraint (current): **do not push to GitHub.** All changes local.

## Scope note
- Seams (2A, 2B): built and tested now.
- **Supabase: schema + ready-to-activate adapter only.** Live wiring needs a
  Supabase project/credentials (external; can't be created from here). Schema is
  in `supabase/migrations/0001_init.sql`; activation steps in `supabase/README.md`.
- **Monorepo (2C): designed, not physically executed** (high churn; the working
  environment can't relocate files). Target layout documented below; the seams
  make a later move mechanical.

## 2A — LLM-client seam (done)
- `src/tools/llm/LLMClient.js` — the interface (one `sendChatMessage` shape).
- `src/tools/llm/index.js` — `getLLMClient(kind)` factory. `'relay'` (canonical)
  returns the existing relay `APIClient`; `'webllm'` and `'proxy'` are explicit
  stubs that throw "not implemented" (reserved for Phase 4).
- Result: providers / dual-model / image backends plug in at ONE place later.
- No caller changes; behavior identical.

## 2B — Persistence seam (done)
- `src/tools/stores/ConversationStore.js` — the interface (exact method surface
  ConversationHandler already uses).
- `src/tools/stores/IndexedDBStore.js` — current Dexie logic, moved behind the
  seam. Default. **Behavior unchanged.**
- `src/tools/stores/SupabaseStore.js` — skeleton implementing the same contract;
  throws a clear setup error until configured (never silently no-ops).
- `src/tools/stores/index.js` — `getConversationStore()` factory; defaults to
  IndexedDB, switches to Supabase via `REACT_APP_PERSISTENCE=supabase`.
- `src/tools/db.js` — now a thin **backward-compat shim** delegating to the store,
  so existing `import db from './db'` (ConversationHandler, FinalAssessment) keeps
  working with zero changes.

## Supabase schema (done — not applied)
- `supabase/migrations/0001_init.sql`: `profiles`, `studies`, `study_members`
  (per-study roles), `access_codes` (anonymous auditor entry), `conversations`,
  `message_reactions`; with `SECURITY DEFINER` helper functions and **Row-Level
  Security** enforcing investigator-sees-own-studies / auditor-sees-own-data.
- `supabase/README.md`: data model summary + Phase 3 activation checklist.

## Tests
- `src/tools/__tests__/seams.test.js` — store factory selection, SupabaseStore
  guardrails (throws until configured), LLM factory selection + stubs.
- Full suite: **46 tests / 5 suites green.** No regressions.

## 2C — Target layout (designed, deferred)
```
packages/
  chatbot-core/      # models, ConversationHandler, stores/, llm/, timer (framework-light)
  chatbot-ui/        # React components/pages/layouts → embeddable <Chatbot>
  dashboard-ui/      # investigator dashboard (Phase 3, fills reader-dashboard/)
apps/
  standalone/        # current self-host web app
server/              # relay (+ optional Supabase Edge Functions / persistence API)
supabase/            # migrations + config (this folder)
```
The new `stores/` and `llm/` folders are the seam units that move into
`chatbot-core` first. Do the physical move when convenient on a real checkout
(the sandbox here cannot relocate/delete files).

## Manual cleanups still pending (from Phase 1, sandbox can't delete)
```bash
cd ~/Documents/GitHub/TRAILS-Website
rm -rf src/trails-chatbot     # dead code
rmdir scripts                 # empty stub
```

## Verification
- [x] 46/46 tests green.
- [x] Production build compiles (clean BUILD_PATH).
- [x] App still defaults to relay + IndexedDB — no behavior change.
