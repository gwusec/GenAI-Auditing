# TRAILS Chatbot Audit Tool — Project Plan (single source of truth)

**Last updated:** 2026-07-10 · **Branch:** `audit-fixes` · **Tests:** 232 passing · `vite build` clean · `node --check` OK

This is the **one** living plan for the TRAILS chatbot-audit web app. It replaces the
previously scattered set of docs (the old `PLAN.md`, `docs/PRD.md`, `docs/AUDIT-FIX-PLAN.md`,
the `docs/phase-*-scope.md` scope docs, `QA-findings.md`, `FIX-PLAN.md`, and the `PHASE0–4.md`
execution logs) — all of which are consolidated here and removed. The separate
"TRAILS-Agents" (agent-trajectory auditing) exploration has been removed from this repo
entirely; it is a different product and not in scope here.

Everything below reflects the **actual state of the code**, which is well ahead of the
old phase tables. When in doubt, trust this document and the test suite.

---

## 1. What this product is

A tool for running **human audits of chatbots**. An *investigator* configures a study
(which model, how the conversation starts, time/turn limits, what evaluation methods to
collect), and *auditors* — often anonymous, recruited in bulk — chat with the model under
that configuration and evaluate it (reactions, span highlights, a questionnaire). The
investigator then reviews and exports the collected data.

**Success bar:** 2–3 external groups run 1–2 studies each, ~6 months after first release.
That disciplines scope toward solid self-hosting + docs over breadth.

---

## 2. Architecture snapshot

- **Frontend:** React 19 + **shadcn/ui (Radix + Tailwind)**, built with **Vite** (migrated off CRA; MUI retired in Phase 1B). Event-sourced
  conversation model; no react-router (state-based routing via `Feature0Shell`).
- **Two entry paths** (`src/index.js`): `REACT_APP_FEATURE0` off → legacy standalone `<App>`;
  on → `<Feature0Shell>` (gate → dashboard / auditor / demo). Production runs Feature 0.
- **Relay:** Node/Express `server/server.js` — holds provider keys server-side, proxies to
  the chosen backend, streams tokens over SSE. Pure helpers in `server/relayHelpers.js`.
- **Backend data:** Supabase (Auth + Postgres + RLS). Migrations `0001`–`0004` applied and
  verified live. Local mode uses IndexedDB (Dexie); the store/auth/studies/sessions layers
  are seams with Mock + Supabase implementations behind a factory.
- **Connectors:** public build offers **Ollama** + **WebLLM** only; commercial providers
  (OpenAI/Anthropic/Gemini/vLLM) unlock in a self-hosted build via
  `REACT_APP_COMMERCIAL_CONNECTORS`. WebLLM runs fully in-browser (WebGPU), bypassing the relay.

---

## 3. Requirement catalog (folded in from the PRD)

Priority: **MVP** (must-have for first release) · **V1** · **Later** (not scheduled).
Status: ✅ done · 🟡 partial · ⬜ not started.

### SC — Study configuration
| ID | Requirement | Pri | Status |
|----|-------------|-----|--------|
| SC-1 | Create/edit a study; saved config fully determines the auditor experience | MVP | ✅ |
| SC-2 | Conversation-control modes: seed_prompt / fixed_first_turn (scripted → Later) | MVP | ✅ |
| SC-3 | Model config: provider, model id, system prompt, decoding params | MVP | ✅ |
| SC-4 | Per-conversation + overall time/turn limits | MVP | 🟡 (UI-enforced; server-side pending — see MOD-4) |
| SC-5 | Number of conversations per auditor (N) | MVP | ✅ |
| SC-6 | Enable evaluation methods independently (reactions / questionnaire / highlighting) | MVP | ✅ |
| SC-7 | Author the questionnaire (visual tier + raw-JSON escape hatch, validated) | MVP | ✅ |
| SC-8 | Bundled templates (≥1 fairness, ≥1 bias) | MVP | ✅ |
| SC-9 | Optional consent text (shown + recorded) | MVP | ✅ |
| SC-10 | Generate access code / join link | MVP | ✅ |
| SC-11 | Study lifecycle (open / closed) | MVP | ✅ |
| SC-12 | Two-model comparison (Arena) | V1 | ⬜ |
| SC-13 | Capture launch URL params (opt-in) | MVP | ✅ |

### AUD — Auditor experience
| ID | Requirement | Pri | Status |
|----|-------------|-----|--------|
| AUD-1 | Anonymous join via code/link, no account | MVP | ✅ |
| AUD-2 | Optional account; sessions associate with it | MVP | 🟡 (anonymous works; account-upgrade not surfaced in UI) |
| AUD-3 | Consent gate when configured | MVP | ✅ |
| AUD-4 | Live chat under config; visible time/turns; limits stop cleanly | MVP | 🟡 (chat/streaming ✅; **timer currently not firing** — bug, see §6 C/D; server-side limits = MOD-4) |
| AUD-5 | Turn-level reactions when enabled | MVP | ✅ |
| AUD-6 | End-and-audit (questionnaire + span highlights + explanations) | MVP | ✅ |
| AUD-7 | Multiple conversations then finish at N | MVP | ✅ |
| AUD-8 | Resume in-progress session after refresh | MVP | 🟡 (study re-entry ✅; in-progress audit state lost on mid-audit refresh) |
| AUD-9 | Blind pairwise choice (Arena) | V1 | ⬜ |
| AUD-10 | Completion handoff (Prolific redirect/code) | Later | ⬜ |

### EVAL — Evaluation data capture
| ID | Requirement | Pri | Status |
|----|-------------|-----|--------|
| EVAL-1 | Capture turn reactions | MVP | ✅ |
| EVAL-2 | Capture questionnaire responses keyed to conversation | MVP | ✅ |
| EVAL-3 | Capture span annotations with stable offsets + quoted text | MVP | ✅ |
| EVAL-4 | Span category taxonomy | Later | ⬜ |
| EVAL-5 | Capture pairwise preference (Arena) | V1 | ⬜ |
| EVAL-6 | Conversation as append-only event log | MVP | ✅ |

### DASH — Investigator dashboard & data
| ID | Requirement | Pri | Status |
|----|-------------|-----|--------|
| DASH-1 | Session/conversation list with status | MVP | ✅ |
| DASH-2 | Per-session drill-down | MVP | ✅ |
| DASH-3 | Basic aggregate graphs | MVP | ✅ |
| DASH-4 | Export all data as tidy/long CSV + JSON | MVP | ✅ |
| DASH-5 | Near-real-time observability | Later | ⬜ |
| DASH-6 | Richer in-app analysis | Later | ⬜ |

### MOD — Models & relay
| ID | Requirement | Pri | Status |
|----|-------------|-----|--------|
| MOD-1 | Server-side model access; no key in the browser | MVP | ✅ |
| MOD-2 | Supported providers at launch (Ollama, vLLM, OpenAI, Anthropic, Gemini) | MVP | 🟡 (all routable; public build = Ollama + WebLLM; vLLM path not yet formally tested/documented) |
| MOD-3 | Apply per-study system prompt + decoding to each call | MVP | ✅ |
| MOD-4 | Enforce time/turn limits server-side | MVP | 🟡 (per-session request ceiling ✅; per-conversation turn/time still UI-only) |
| MOD-5 | Parallel dispatch for Arena | V1 | ⬜ |
| MOD-6 | Image generation via relay | Later | ⬜ |
| MOD-7 | Per-study & per-session request-count ceilings | MVP | ✅ |
| MOD-8 | Per-request BYO key (hosted demo), in-memory only | MVP | 🟡 (relay supports it; largely superseded by the connector-gating decision) |

### SEC — Accounts, roles & isolation
| ID | Requirement | Pri | Status |
|----|-------------|-----|--------|
| SEC-1 | Investigator accounts | MVP | ✅ |
| SEC-2 | Anonymous auditor sessions | MVP | ✅ |
| SEC-3 | Per-study roles/membership (no global role) | MVP | ✅ |
| SEC-4 | Data isolation via Postgres RLS | MVP | ✅ (cross-investigator isolation verified live) |
| SEC-5 | Image storage under isolation | Later | ⬜ |

### DEP — Deployment
| ID | Requirement | Pri | Status |
|----|-------------|-----|--------|
| DEP-1 | Turnkey self-host (Docker: frontend + relay + Supabase) | MVP | ✅ |
| DEP-2 | Local / no-backend trial mode (IndexedDB) | MVP | ✅ (conversations/timer are global, not study-scoped — known limitation) |
| DEP-3 | Hosted demo instance (throwaway data, guardrails) | MVP | 🟡 |
| DEP-4 | Publishable npm component | V1 | ⬜ |
| DEP-5 | Multi-language UI | Later | ⬜ |

### UX — Experience & visual design
| ID | Requirement | Pri | Status |
|----|-------------|-----|--------|
| UX-1 | Cohesive visual design system | V1 | 🟡 (teal theme, light/dark, SurveyJS bridged — done; full sweep pending) |
| UX-2 | Smooth auditor flow with preserved state | V1 | 🟡 |
| UX-3 | Considered interaction states (loading/empty/error/streaming/countdown) | V1 | 🟡 |
| UX-4 | Polished core interactions; SurveyJS styled to app | V1 | 🟡 |
| UX-5 | Responsive, clean layout | V1 | ⬜ |

---

## 4. Status by category

Three lenses — **Frontend**, **Backend**, **Features** — across the product areas.
Each cell: what's done → what remains.

### 4.1 Frontend

| Area | Done | Remaining |
|------|------|-----------|
| **Global** | Design system (**Tailwind + shadcn/ui**: teal accent as CSS-variable tokens in `index.css`, light+dark via `.dark` class, persisted toggle in `theme.js`, SurveyJS bridged via `--sjs-*` → the same tokens); `Feature0Shell` state routing; chat redesign (avatars, slim bubbles, typing indicator, entrance animation); footer-clipping + autofill-styling fixes | UX-rework steps 2–6 (auditor chat polish → investigator wizard polish → responsive/a11y); floating "personal info" tooltip bubbles bug; broader polish |
| **Setup** | `StudyConfigForm` (collapsible sections, minutes-based timers, provider picker, reaction toggles, consent); `OllamaConnectorPanel` + `WebLLMConnectorPanel`; `QuestionnaireAuthor` (visual + raw-JSON); `StudySetup`; bundled fairness/bias templates | Fully retire legacy `SurveyMaker`; dashboard "Create & set up" button clipped at card edge |
| **Chatbot** | `ChatBox`/`ChatMessages`/`MessageForm`/`ChatHistory`, `LoadingDots` typing indicator, streaming bubble, timer countdown/warnings, teal user bubbles, safety notices | Floating tooltip-bubble bug; UX polish pass (step 2) |
| **Audit** | Inline turn reactions; `AuditFlow` (span-highlight step + SurveyJS questionnaire); `Questionnaire`; `FinalAssessment`; gating via `auditPlan` — verified live | Reactions wrongly render on the audit transcript; ~1-char highlight boundary; 8-step tutorial too long; legacy `AuditForm` still present as fallback |
| **Dashboard** | `StudyDashboard` (study cards: create/configure/preview/data); `StudyData` (aggregates, per-conversation list, CSV/JSON download) | Richer analysis (DASH-6, Later); realtime (DASH-5, Later); button-clip fix |
| **Users** | `InvestigatorAuth` (sign in/up); `AuditorJoin` (code entry, `?code=` prefill); `Feature0Gate` (three entries); autofill styling fix | Surface optional auditor account-upgrade (AUD-2) |
| **Auditor** | `ConsentGate`; demo mode; resume-from-localStorage re-entry; consent not re-prompted after refresh | Deep resume of in-progress audit (AUD-8); PREVIEW needs two clicks; tutorial length |
| **Investigator** | Dashboard cards, `StudySetup`, `previewStudy` path, open/close gated on config validity | Minor wizard polish; double-check no leftover auditor-language in investigator screens |

### 4.2 Backend

| Area | Done | Remaining |
|------|------|-----------|
| **Global** | Express relay; SSE streaming (Ollama + OpenAI-compatible); fail-closed CORS; `createRateCeiling`; `relayHelpers` | Relay supertest coverage for new endpoints (deferred); set `ALLOWED_ORIGINS` at deploy |
| **Setup** | `/api/list-models`, `/api/test-model`, `/api/test-api-key`, `/api/ollama/models`, streamed `/api/ollama/pull`, `/api/ollama/api/tags`; `SupabaseStudyService` + studies RLS | Retire the static `/api/webllm/models` endpoint (superseded by client catalog); formally test/document vLLM (MOD-2) |
| **Chatbot** | `/chat` routing (ollama / api providers); `resolveDecoding` + `ensureSystemMessage` (P3); server-side keys via env (MOD-1); per-session request ceiling (MOD-7); SSE; WebLLM handled client-side | Server-side per-conversation turn/time enforcement (MOD-4); close out MOD-8 BYO-key |
| **Audit** | Event-sourced `conversations.chat_events` (jsonb); `message_reactions`; `append_chat_event` RPC (0004); audit stored on conversation | Span category taxonomy (EVAL-4, Later) |
| **Dashboard** | `SupabaseStore` reads under RLS; `export/` projection (tidy CSV+JSON, single source); `summarize` | Realtime + richer queries (DASH-5/6, Later) |
| **Users** | `SupabaseAuthProvider` (incl. anonymous); `study_members` roles; RLS isolation (0001); `redeem_access_code` RPC (0002/0003); profile auto-provision | Rotate committed self-host `JWT_SECRET`/anon key; document the two Supabase dashboard toggles |
| **Auditor** | `auditor_sessions` (0003); redeem gate (study must be OPEN); consent/launch/progress columns; append-only events verified live with an anonymous auditor | Persist in-progress audit state for deep resume (AUD-8) |
| **Investigator** | `SupabaseStudyService` CRUD; status `draft|open|closed`; provenance columns; config versioning | One-time scrub of any legacy stored keys (if present) |

### 4.3 Features (cross-cutting behavior)

| Area | Done | Remaining |
|------|------|-----------|
| **Global** | Self-host docker-compose (app+relay+Supabase); local IndexedDB mode; config versioning + provenance (D9); connector public-gating | Hosted-demo guardrails (DEP-3); resolve `npm audit` vulnerabilities |
| **Setup** | Control modes (SC-2), model config (SC-3), limits (SC-4), N (SC-5), method toggles (SC-6), consent (SC-9), crypto access codes (SC-10), lifecycle (SC-11), launch capture (SC-13), templates (SC-8) | Arena two-model config (SC-12, V1) |
| **Chatbot** | Control-mode seeding at conversation creation; timers; streaming; P3 framing reaches the model (verified live); connectors (Ollama select/pull, WebLLM in-browser) | Server-side limit enforcement (MOD-4); Arena parallel dispatch (MOD-5, V1) |
| **Audit** | Reactions (EVAL-1), questionnaire (EVAL-2), spans w/ hardened offsets (EVAL-3/D6), append-only log (EVAL-6), finish at N (AUD-7) — verified live | Deep resume (AUD-8); span taxonomy (EVAL-4, Later); pairwise capture (EVAL-5, V1) |
| **Dashboard** | List+status, drill-down, aggregates, tidy export (DASH-1..4) — verified live; one projection → CSV+JSON round-trip tested; questionnaire-export bug fixed | Realtime + richer analysis (DASH-5/6, Later) |
| **Users** | Accounts, anonymous, per-study dual roles (investigator on A + auditor on B), RLS isolation (SEC-1..4) verified | Optional auditor account-upgrade flow (AUD-2) |
| **Auditor** | Anonymous join, consent record, multi-conversation, basic resume — verified live | Deep in-progress-audit resume (AUD-8); Prolific handoff (AUD-10, Later) |
| **Investigator** | Full loop: create → configure → preview → open/close → view/export data — verified live | Arena setup (V1) |

### 4.4 Others (don't fit a single area)

- **Security / deploy hardening:** rotate the committed self-host `JWT_SECRET`/anon key;
  public-deploy checklist (set `ALLOWED_ORIGINS`, review rate limits); one-time scrub of any
  stored provider keys.
- **Dependencies:** `npm audit` reports 15 vulnerabilities (9 moderate / 3 high / 3 critical),
  mostly transitive — triage before public deploy.
- **Legacy cleanup:** remove the legacy `AuditForm` + `SurveyMaker` once the new flow is the
  only path; delete the dead `src/tools/llm/` stub and empty `src/lib.js`; retire the static
  `/api/webllm/models`.
- **Testing:** add relay supertest coverage for the new Ollama endpoints (deferred).

---

## 5. Remaining work — prioritized

**Before a public deploy (blocking):**
1. Rotate the committed self-host `JWT_SECRET` / anon key; scrub any stored provider keys.
2. Set `ALLOWED_ORIGINS` and review rate limits for the deploy target.
3. Triage `npm audit` (3 critical / 3 high).
4. Enable the required Supabase Auth toggles: **disable email confirmation** + **enable
   anonymous sign-ins** (needed for the auditor flow).

**MVP polish (should-do):**
5. Server-side enforcement of per-conversation turn/time limits (MOD-4).
6. Deep resume of an in-progress audit (AUD-8): persist highlights + partial questionnaire.
7. QA/UX bug sweep: reactions-on-transcript, ~1-char highlight boundary, floating tooltip
   bubbles, two-click PREVIEW, condense the 8-step tutorial, dashboard button clip, DEP-2
   study-scoped local timer/conversations.
8. Legacy cleanup (AuditForm/SurveyMaker/`llm` stub/`lib.js`/static webllm endpoint).

**V1 (Phase F):**
9. UX-rework steps 2–6 (UX-1..5): auditor chat polish → investigator wizard polish →
   responsive + a11y sweep.
10. Arena: two-model config (SC-12), blind pairwise (AUD-9), preference capture (EVAL-5),
    parallel dispatch (MOD-5).
11. Publishable npm component (DEP-4).

**Later (Phase G, not scheduled):** image gen + annotation (MOD-6/SEC-5); realtime +
richer analysis (DASH-5/6); span taxonomy (EVAL-4); Prolific completion loop (AUD-10);
i18n (DEP-5).

> A larger enhancement backlog was captured on 2026-07-10 — see **§6** below.

---

## 6. Planned enhancements — 2026-07-10 backlog

Captured from a review session. Item numbers **[n]** match the source list. Grouped by
theme and cross-referenced to the requirement catalog (§3); **NEW** marks scope beyond the
current PRD. Several items imply real design decisions (flagged) before implementation.

### A. Roles, profiles & assignment  (NEW — extends SEC-1/2/3, AUD-2)
The biggest architectural theme: make **auditor** and **investigator** two *profiles a single
account can hold*, not two separate account types.
- **[6] Two profiles per account.** Every account has an **auditor** profile; investigators
  additionally have an **investigator** profile. Auditor-only accounts see only the auditor
  side. Separate landing screen per profile.
- **[2] Investigator-as-auditor without signing out.** An investigator can take/audit studies
  under their auditor profile — a profile switch, not an account switch.
- **[5] Auditor accounts.** Auditors can register a real account (email/password), not only
  join anonymously by access code (AUD-2). Anonymous join stays supported.
- **[7] Study assignment.** An investigator assigns a study to an auditor by **username or
  email**; it then appears on that auditor's dashboard as "assigned to audit."
- *Design note:* needs a data-model change (per-user profiles + assignment table) and RLS
  updates; touches Users/Auditor/Investigator across all three lenses.

### B. Landing screens & dashboards  (NEW — extends DASH-1/2/3/6)
- **[6] Role-specific landing screens.** Investigator: studies they **created** + studies
  they're **assigned / auditing / completed**. Auditor: studies **assigned** + **completed**.
- **[4] "Live conversations" tab.** A view of what conversations people are currently having
  in a study (browse ongoing / collected conversations).
- **[8] Personal analytics dashboards.** Auditor: analysis of their own audit activity.
  Investigator: per-study combined analysis + graphs across all audits of their study.

### C. Setup / study-config rework  (extends SC-4/6/7/8, UX-1)
- **[1] Setup screen reorganization** — another major UI rework; more organized layout.
- **[20] Audit-question builder.** Question setup is out of proportion (title bar + questions
  oversized); add **multi-page** questionnaires; design a proper in-app survey maker for setup.
- **[21] More template questionnaires** beyond the fairness/bias pair (SC-8).
- **[16] Editable principles + sidebar message.** Add/remove the conversation "principles";
  add/remove the sidebar guidance message (e.g. "on average a user needs ~7 messages").
- **[15] Timer config.** Timer is **currently not working** (bug); add on/off + better config
  (relates to SC-4 / AUD-4 / MOD-4).

### D. Chatbot UX & behaviour  (extends AUD-4, EVAL-6, UX-2/3)
- **[14] Collapsible sidebar.**
- **[13] Interrupted streaming.** Define + implement what happens when a streaming reply is
  **stopped mid-way**: how the partial message is stored (append-only event log, EVAL-6).
  Needs a clear data contract + test.
- **[15] Timer** (see C) — the runtime countdown itself isn't firing.
- **[16] Principles / sidebar message** (see C) — the runtime rendering side.

### E. Audit & highlighting  (bugs + extends EVAL-3)
- **[17] Highlighting is broken.** Overlapping highlights aren't visually distinguishable;
  add an **optional comment per highlight**; multi-point (multi-span) highlighting doesn't
  highlight correctly.
- **[18] Condensed long highlights.** Long highlights condense at the top; show the full text
  on hover.
- **[19] Click-to-scroll.** Clicking a highlight at the top scrolls the chat to bring that
  span into focus.
- **[20] Audit screen sizing** (see C) — proportions of the questions view need fixing.

### F. Connectors & packaging  (extends MOD-2, DEP-4)
- **[3] Remote auditors.** Today it assumes investigator + auditor share one machine. When
  they're on **different machines**, the auditor needs their own model access — pull Ollama
  models or use WebLLM **from the auditor side**. Surface model setup/pull in the auditor flow.
- **[11] Robust cloud connectors.** Replace the generic HTTP relay calls for OpenAI /
  Anthropic / Gemini with their **official SDKs** (direct imports) — evaluate `openai`,
  `@anthropic-ai/sdk`, `@google/generative-ai`.
- **[12] npm library release.** Prepare the app/component for npm publication (DEP-4).

### G. Code quality & open-source readiness
- **[9] Code cleanup & organization.**
- **[10] Comment every source file** to prepare for an open-source release.

---

## 7. Work log

### 2026-07-03 → 2026-07-09 — audit fixes + MVP build (branch `audit-fixes`)
Committed the whole working tree (junk cleanup → CRA→Vite migration → audit fixes P0–P2 →
hygiene). **P3** (relay honors `relay.decoding` + applies the study system/seed prompt),
**consent gate + auditor sessions**, **dashboard + tidy CSV/JSON export**. Unit suite grew
to 211 green.

### 2026-07-10 — UI, hardening, Supabase live verification
Live Docker QA of the full flow (fixed a questionnaire-export bug found during QA).
**Streaming chat (SSE)** for Ollama + OpenAI-compatible. **Visual pass** (teal accent,
dark/light, chat redesign, SurveyJS themed). **Relay hardening** (per-session request
ceiling MOD-7, fail-closed CORS). **Supabase `0001`–`0004` applied + verified live**,
including cross-investigator RLS isolation and append-only events via an anonymous auditor.
Suite at 220.

### 2026-07-10 — Model connectors
- **Public connector gating:** provider list gated on `availableProviders()` /
  `REACT_APP_COMMERCIAL_CONNECTORS`. Public build offers only **Ollama + WebLLM**, with an
  in-UI note that commercial providers are supported only via a self-hosted deployment
  (keys stay server-side). Flag wired through the self-host Dockerfile / compose / `.env`.
- **WebLLM added as a provider** (`schema.js`, no key / no base URL) with a `backend:'webllm'`
  branch in `modelToRelay` (never routed to the relay).
- **Ollama connector — commercial-grade UX** (`OllamaConnectorPanel`): live connection
  status, installed-model picker with metadata (size / params / quantization), and an in-app
  **model-pull** flow with streaming progress. New relay endpoints `POST /api/ollama/models`
  and SSE `POST /api/ollama/pull`.
- **WebLLM connector — built from scratch** on `@mlc-ai/web-llm` (lazy-loaded, code-split
  into its own chunk): `webllmEngine` (WebGPU probe, full 160+ model catalog, load w/
  progress, streaming chat) + investigator panel (WebGPU check, catalog picker, download &
  test) + auditor runtime (`APIClient` intercepts `backend:'webllm'`, runs in-browser,
  surfaces load progress via `onStatus`). Removed the stale legacy `src/utils/WebLLMClient.js`.
- Tests: connector gating, webllm schema/wire mapping, WebLLM engine helpers. Suite at **231**.

### 2026-07-10 — Phase 1B: UI foundation swap (MUI → shadcn/ui + Tailwind) `[D1]`
- **Tailwind + shadcn set up:** Tailwind v3 + PostCSS + `tailwindcss-animate`; teal light/dark
  palette moved into CSS-variable tokens (`src/index.css`) driving `tailwind.config.js`; `cn()`
  helper (`clsx` + `tailwind-merge`).
- **Primitive library** (`src/components/ui/*`): button, input, textarea, label, card, dialog,
  alert, badge, separator, tabs, tooltip, checkbox, switch, select, radio-group, toggle-group,
  avatar, progress, spinner, table, accordion (Radix-based), plus compat layout primitives
  (Box/Stack/Grid/Typography/List/Divider) and a lucide-react icon shim under the old MUI names.
- **theme.js** rewritten to a Tailwind dark-class provider (toggles `.dark` on `<html>`,
  persists `themeMode`); `ThemeModeProvider`/`useColorMode` API unchanged. `CssBaseline` retired.
- **SurveyJS re-bridged:** `--sjs-*` variables now point at the new CSS-variable tokens (no MUI
  `useTheme`/`alpha`), so the questionnaire follows light/dark automatically.
- **All 32 `@mui` files migrated** (App.jsx, feature0/, components/, layouts/) to the new
  primitives; every `sx` prop converted to Tailwind `className` (or plain `style` for dynamic
  values); `<Grid>` → Tailwind 12-col grid. **`@mui/*` + `@emotion/*` removed** from
  `package.json` — build verified clean with them deleted from `node_modules`.
- Added a `ui.smoke.test.jsx` render check for the primitive library. Suite at **232**,
  `vite build` clean, `node --check server/server.js` OK. Visual/behavioral parity to be
  confirmed live in the Cowork chat (Phase 1B exit criterion).

---

## 8. How to verify / run

- **Tests:** `npx vitest run` (232 passing). **Build:** `npx vite build`. **Relay syntax:**
  `node --check server/server.js`.
- **Local dev:** `npm run dev` (Vite). Local mode uses IndexedDB; no backend required.
- **Self-host:** `self-host/docker-compose.trails.yml` (app + relay + Supabase). See
  `self-host/SELF-HOST.md`. `REACT_APP_*` are baked at build time — rebuild after changing them.
- **Supabase:** apply `supabase/migrations/0001`–`0004` in order; see `supabase/SETUP.md`.
  Enable anonymous sign-ins and disable email confirmation for the auditor flow.
