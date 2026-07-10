# TRAILS Chatbot Audit Tool — Build Plan & Roadmap

> Status: **planning + active build.** This plan is the engineering counterpart to
> the product spec in [`docs/PRD.md`](docs/PRD.md) (Draft v0.1, 2026-06-29). The PRD
> is authoritative for *what* and *priority*; this file is authoritative for *how*
> and *in what order*, and maps every PRD requirement ID onto concrete work against
> the current codebase.
> Success bar (PRD §2.2): **2–3 external groups run 1–2 studies each, ~6 months
> after first release.** That bar disciplines everything below — solid self-hosting
> and docs over breadth.

---

## 0. What changed from the previous plan (read this first)

The earlier roadmap froze a broad "v1" list. The PRD narrows and re-sequences it
into **MVP / V1 / Later**. The deltas that change real work:

| Topic | Old plan | PRD v0.1 (now authoritative) | Effect on work |
|-------|----------|------------------------------|----------------|
| Image generation + annotation | In v1 | **Later** (explicit non-goal) | Drop from near-term scope. Do **not** build image-gen relay path, blob storage, or region/bbox UI now. |
| Real-time observability | In v1 | **Later** (DASH-5) | MVP dashboard reads completed/aggregate data only. Defer Supabase Realtime. |
| Provider launch set | OpenAI/Anthropic/Cohere/Gemini/Ollama/WebLLM | **vLLM + OpenAI + Anthropic + Gemini**, tested & documented (MOD-2) | Add a **vLLM** path (OpenAI-compatible). Ollama/WebLLM/Cohere become untested extras, not part of the supported launch matrix. |
| Conversation-control modes | Barely present | **MVP backbone** (SC-2, §6.6): seed-prompt / fixed-first-turn only — **scripted deferred to Later** (§9 D2) | New first-class config + enforcement + per-conversation recording of mode + seed/first-turn. Both modes keep the model live; no model-bypass path. |
| Export | "basic" / advanced deferred | **Tidy/long CSV *and* JSON, MVP** (DASH-4) | Build the one-row-per-observation projection now. |
| Bundled templates | not specified | **MVP** (SC-8): ≥1 fairness + ≥1 bias schema | Ship template JSON with the app. |
| Build tooling | "recommended follow-up" | **CRA → Vite, MVP architecture track** | Migrate before the npm build and the UX polish; also clears most `npm audit` findings. |
| UX / visual design | "redesign track" | **Explicit V1 surface** (§5.8, UX-1..5), auditor-first | A named V1 workstream with acceptance criteria. |
| StudyConfig versioning | implicit | **Versioned** (§7) | Tie collected data to the exact config in force. |
| Prolific | full loop deferred | Loop still **Later**; but **capture launch URL params now** (SC-13, §9 D7) | Opt-in/default-off MVP add: store opaque `?PROLIFIC_PID=...` on the session, consent-disclosed. |
| Cost caps | v1.1 | **MVP** (MOD-7, §9 D4) | Add a simple per-study **and** per-session **request-count** ceiling in the relay; refuse on hit. No token accounting. |
| Hosted-demo keys | "disable commercial providers" | **MVP** (MOD-8, §9 D5): commercial providers via **visitor BYO-key**, never persisted | Relay accepts a per-request key, uses it in-memory, never logs/stores it. Scoped carve-out from MOD-1. |

Everything not in this table that the old plan had (seams, per-study RLS, anonymous
auditor join, the relay keeping keys server-side, SurveyJS-free + in-house authoring,
turnkey docker-compose) **survives unchanged** and is reaffirmed below.

---

## 1. Current state of the codebase (honest baseline)

Phases 0–3 of the previous plan are already executed locally (see `PHASE0–3.md`).
What exists today:

- **Frontend:** React 19 + MUI 6 on **Create React App**. Event-sourced conversation
  model (`src/tools/models.js`, `src/tools/ConversationHandler.js`), timer system
  (`ChatTimerSystem.js`), audit/highlight UI, and a custom survey path.
- **Seams in place:** LLM-client seam (`src/tools/llm/`), persistence seam
  (`src/tools/stores/` — IndexedDB default, Supabase skeleton), auth seam
  (`src/tools/auth/` — mock default, Supabase skeleton), studies seam
  (`src/tools/studies/`). All default to local/mock; Supabase activates by env flag.
- **Feature 0 (accounts/roles/studies):** `src/feature0/` — investigator auth, study
  dashboard, anonymous auditor join by code, per-study role scoping. Opt-in behind
  `REACT_APP_FEATURE0`.
- **Relay:** `server/server.js` (Express). Supports **ollama, openai, anthropic,
  cohere, gemini** today. Hardened: CORS allowlist, per-IP rate limiting, timeouts,
  SSRF protection, secret redaction. **No vLLM path yet.**
- **Supabase:** schema + RLS migrations (`supabase/migrations/0001_init.sql`,
  `0002_auth_glue.sql`); not yet activated against a live project.
- **Self-host:** `self-host/` docker-compose + docs (relay path).
- **Known debt:** built on CRA (drives most `npm audit` findings + blocks the npm
  library build); custom survey path not yet SurveyJS; no conversation-control modes;
  export is minimal; `package.json main` still ships raw JSX.

So the gap to the PRD is **not** "start from scratch" — the backbone and seams exist.
It is: finish the MVP evaluation methods, add the missing config dimensions, swap the
build tooling, and tighten the data/export path.

---

## 2. Locked decisions (reaffirmed under the PRD)

1. **Supabase** (Postgres + Auth + RLS + Storage) is the multi-user backend; the relay
   stays for server-side keys. Realtime is **deferred to Later** (DASH-5).
2. **Per-study roles, not global** (SEC-3). One account can be investigator on one
   study and auditor on another via Membership.
3. **Anonymous auditor join** by code/link is the default (AUD-1/SEC-2); account
   optional (AUD-2).
4. **SurveyJS Form Library (MIT) for rendering + an in-house authoring UI** (no paid
   Creator) emitting SurveyJS JSON, with a raw-JSON escape hatch. SurveyJS covers the
   questionnaire **only**; turn reactions, span highlighting, and Arena are custom.
5. **Conversation is an append-only event log** (EVAL-6); evaluation data is **separate
   records** referencing messages (PRD §7). Keep stimulus separable from judgment.
6. **Three deployment modes** with hard boundaries: self-host (real studies, DEP-1),
   local/IndexedDB (dev/trial/embed, single-user, DEP-2), hosted demo (throwaway, not
   for real subjects, DEP-3). npm component is a fourth distribution form (DEP-4, V1).
7. **Provider launch matrix = vLLM, OpenAI, Anthropic, Gemini** (MOD-2). vLLM is the
   privately-hosted path via its OpenAI-compatible API.
8. **CRA → Vite** before the library build and the UX polish.
9. **Image and Realtime are out of near-term scope** (Later).

---

## 3. Requirement → work mapping

For each PRD area: what already exists, and what this plan adds. IDs are the PRD's.

### 3.1 Study configuration (SC) — MVP
- **Exists:** study creation + access codes (`feature0/StudySetup.jsx`,
  `StudyDashboard.jsx`); the Supabase `studies` table.
- **Build:**
  - **StudyConfig object (versioned)** as the single backbone (SC-1, PRD §7): one
    schema holding control mode + seed/script, model config(s), enabled methods,
    limits, conversations-per-auditor, consent, lifecycle state. Persist a version so
    data ties to the config in force.
  - **Conversation-control mode** UI + storage (SC-2): `seed_prompt | fixed_first_turn`
    only (`scripted` reserved, Later — §9 D2). Record mode + seed/first-turn on every
    Conversation (§6.6). No script editor / dialogue-tree UI; no model-bypass path.
  - **Capture launch params** (SC-13, §9 D7): opt-in per study (default off); store opaque
    query params (`?PROLIFIC_PID=...`) in `AuditorSession.launch_metadata`, separate from
    audit data; disclose in consent when on.
  - **Model config** UI (SC-3): provider/model-id/system-prompt/decoding, written to
    the relay call (MOD-3).
  - **Limits** UI (SC-4) → enforced server-side (MOD-4).
  - **Conversations-per-auditor N** (SC-5); **method toggles** (SC-6); **questionnaire
    authoring** (SC-7) + **bundled fairness/bias templates** (SC-8); **optional consent
    text** (SC-9); **open/closed lifecycle** (SC-11).
  - **Two-model config (Arena)** (SC-12) — **V1**.

### 3.2 Auditor experience (AUD) — MVP
- **Exists:** anonymous join (AUD-1), chat + timers (AUD-4 partial), end-and-audit with
  highlights (AUD-6 partial), event-log resume groundwork (AUD-8).
- **Build:** optional account (AUD-2); **consent gate** recording version+timestamp
  (AUD-3); enforce control mode + visible limits in chat (AUD-4); **turn-level
  reactions UI** (AUD-5); questionnaire via SurveyJS in the audit step (AUD-6);
  multi-conversation finish to N (AUD-7); robust resume from event log + persisted
  responses (AUD-8). **Blind A/B (AUD-9) — V1. Prolific handoff (AUD-10) — Later.**

### 3.3 Evaluation capture (EVAL) — MVP
- **Exists:** event log (EVAL-6); free-text span annotations (EVAL-3, needs offset
  hardening §6.4); custom questionnaire responses (EVAL-2, migrate to SurveyJS schema).
- **Build:** turn-reaction records (EVAL-1); SurveyJS-schema-keyed responses (EVAL-2);
  **span-offset stability** (EVAL-3/§6.4, §9 D6): offsets index the canonical stored
  string; render highlights by slicing that same string (not over rendered HTML);
  store `quoted_text` and assert `canonical[start:end] === quoted_text` on read (flag on
  mismatch). Streaming is not in the highlight path. **Pairwise preference (EVAL-5) — V1.
  Span taxonomy (EVAL-4) — Later.**

### 3.4 Dashboard & data (DASH) — MVP
- **Exists:** `reader-dashboard/` is an empty placeholder; investigator dashboard is the
  Feature-0 study list only.
- **Build:** session/conversation list with status (DASH-1); per-session drill-down
  (DASH-2); basic aggregate graphs — flag counts, Likert distributions (DASH-3);
  **tidy/long CSV + JSON export**, one row per observation, each row carrying
  **provenance columns** — control mode, seed/first-turn, model config id+version, and
  `launch_metadata` when SC-13 is on (DASH-4, §9 D9). **Realtime (DASH-5) and richer
  analysis (DASH-6) — Later.**

### 3.5 Models & relay (MOD) — MVP
- **Exists:** server-side keys (MOD-1); openai/anthropic/gemini/cohere/ollama paths;
  hardening.
- **Build:** **vLLM provider** (MOD-2) via OpenAI-compatible endpoint+key; apply
  per-study system prompt + decoding (MOD-3); **enforce limits server-side** (MOD-4);
  **per-study + per-session request-count ceiling** (MOD-7, §9 D4) — refuse on hit, no
  token accounting; **per-request BYO-key path for the hosted demo** (MOD-8, §9 D5) —
  use the visitor key in-memory only, never persist/log it (redact in logging/error
  handlers). **Parallel Arena dispatch with independent per-model histories (MOD-5) — V1.
  Image gen (MOD-6) — Later.**

### 3.6 Accounts/roles/isolation (SEC) — MVP
- **Exists (as mock + Supabase skeleton):** investigator accounts (SEC-1), anonymous
  sessions (SEC-2), per-study membership (SEC-3), RLS policies (SEC-4).
- **Build:** activate against a live Supabase project; finish skeleton method bodies;
  add anonymous-code-redemption RPC; verify RLS end-to-end. **Image storage (SEC-5) —
  Later.**

### 3.7 Deployment (DEP) — MVP
- **Exists:** docker-compose self-host (DEP-1) relay path; IndexedDB local mode (DEP-2).
- **Build:** complete turnkey self-host incl. Supabase stack + documented env (DEP-1);
  keep local mode as **non-syncing** dev/trial/embed only and document the boundary
  (DEP-2, §9 D8); stand up a **hosted demo** (DEP-3, §9 D5) with throwaway-data TTL,
  a persistent "demo only — no real participant data" banner, per-IP/session rate +
  conversation caps, no-signup, **commercial providers via visitor BYO-key only**
  (MOD-8), optional one zero-key operator-funded vLLM model under hard caps, export
  optionally disabled. **npm component (DEP-4) — V1. i18n (DEP-5) — Later.**

### 3.8 Experience & visual design (UX) — V1
- Cohesive design system (UX-1); smooth auditor flow join→finish (UX-2); designed
  loading/empty/error/completion states incl. streaming + countdown (UX-3); polished
  core interactions incl. SurveyJS styled to the app (UX-4); responsive layout (UX-5).
  Auditor surface first; pairs with the Vite migration. Must not regress WCAG 2.1 AA
  (§8.2).

### 3.9 Architecture track
- **CRA → Vite** migration (clears most `npm audit` debt, enables fast dev + the library
  build); MIT SurveyJS Form Library + in-house authoring UI. **V1:** library build for
  the embeddable component (ESM+CJS+types, React/MUI as peerDeps).

---

## 4. Phasing

Ordered by dependency. Phases A–E are **MVP**; F is **V1**; G is **Later**. Each item
ships with tests + docs + (where relevant) a per-study config flag.

### Phase A — Foundation cleanup & build swap
- Remove confirmed dead code (`src/trails-chatbot/`, empty `scripts/`). Confirmed
  unreferenced (only the event-name string `'trails-chatbot:audit-finished'` remains in
  active code). **Pending a manual `rm` on the real checkout** — the sandbox can't delete
  mounted files:
  ```bash
  rm -rf src/trails-chatbot && rmdir scripts
  ```
- **CRA → Vite** migration — **done** (see `PHASE4.md`). Vite dev/build + Vitest test
  runner; all 60 characterization tests still green; `npm audit` 58 → 5 findings
  (remaining are dev-only Vitest toolchain). Library-build for the npm component (the
  `package.json` raw-JSX entry) is the remaining piece, scheduled with **DEP-4 (V1)**.
- Confirm one canonical relay contract and document it.

### Phase B — Study-config backbone
> Detailed scope + progress: [`docs/phase-b-study-config-scope.md`](docs/phase-b-study-config-scope.md).
> **Status: units + config UI + live wiring done (suite 130/13 suites, build green).**
> Config now drives the live auditor app (limits via `ChatTimerSystem`) and control-mode
> seeding applies at conversation creation. Remaining: `AuditorSession` in the live flow
> (consent record + launch capture + attach), which lands with Phase E persistence.
- Versioned **StudyConfig** schema + investigator config UI: SC-1, SC-2 (two live control
  modes only — `seed_prompt | fixed_first_turn`, §9 D2), SC-3, SC-4, SC-5, SC-6, SC-9,
  SC-11.
- Record control mode + seed/first-turn per Conversation (§6.6). No script editor.
- Capture opaque launch params (`?PROLIFIC_PID=...`) on the session, opt-in/default-off,
  consent-disclosed (SC-13, §9 D7).

### Phase C — Evaluation methods
> Detailed scope + decisions: [`docs/phase-c-evaluation-scope.md`](docs/phase-c-evaluation-scope.md).
- **SurveyJS** Form Library rendering + in-house authoring UI + raw-JSON escape hatch:
  SC-7, EVAL-2. Authoring UI tier (§9 D1): single/multi choice, Likert/rating, **Likert
  matrix/grid**, short/long text, page breaks, instructions, required, basic conditional
  visibility; everything else via raw JSON. **Validate JSON against the Form Library
  before save.** Bundled fairness/bias templates (SC-8) — they lean on the matrix type.
- **Turn-level reactions**: AUD-5, EVAL-1.
- **Span-offset hardening**: EVAL-3/§6.4/§9 D6 — index the canonical stored string, render
  by slicing it (not over rendered HTML), store `quoted_text`, assert equality on read.
- **Consent gate**: AUD-3, SC-9.
- Multi-conversation finish + resume: AUD-7, AUD-8.

### Phase D — Relay & limits
- **vLLM provider** path (MOD-2); apply per-study system prompt + decoding (MOD-3);
  **server-side limit enforcement** (MOD-4); **per-study + per-session request ceilings**
  (MOD-7, §9 D4); **per-request BYO-key path** for the demo (MOD-8, §9 D5) — in-memory
  only, never persisted/logged.

### Phase E — Persistence, dashboard, export, deploy
- Activate **Supabase** (auth + studies + conversations + RLS): SEC-1..4; study-scoped
  conversation persistence.
- Dashboard MVP: DASH-1, DASH-2, DASH-3 (fills `reader-dashboard/`).
- **Tidy/long CSV + JSON export** with provenance columns per row (DASH-4, §9 D9).
- Turnkey self-host incl. Supabase (DEP-1); hosted demo with guardrails + BYO-key
  (DEP-3, §9 D5); document the non-syncing local-mode boundary (DEP-2, §9 D8).

### Phase F — V1
- **Arena**: SC-12, AUD-9, EVAL-5, MOD-5. Per-turn preference is the core signal +
  optional overall judgment (default per-turn, §9 D3). Two models keep **independent
  histories** and both answer every auditor turn; the chosen side is a label only and is
  **never fed forward** as context. Store the side→model map (never shown to the auditor).
- **UX/visual-design pass**: UX-1..5 (auditor-first).
- **npm component**: DEP-4 (library build).

### Phase G — Later (not scheduled)
Image gen + annotation (MOD-6, SEC-5), Realtime observability + richer analysis
(DASH-5/6), span taxonomy (EVAL-4), Prolific completion loop (AUD-10), i18n (DEP-5).

---

## 5. Resolved scoping decisions

The PRD's nine open questions are **resolved** (2026-06-29); full text in **PRD §9 D1–D9**.
Summary + where each lands:

1. **D1 — Authoring-UI tier** (Phase C): single/multi choice, Likert/rating, Likert
   matrix/grid, short/long text, pages, instructions, required, basic conditional in the
   UI; everything else via raw JSON. Validate against the Form Library before save.
2. **D2 — Control modes** (Phase B): ship `seed_prompt` + `fixed_first_turn` only;
   `scripted` deferred to Later (reserved name). Simplifies Phase B.
3. **D3 — Arena granularity** (Phase F): per-turn core + optional overall (default
   per-turn); independent per-model histories; chosen side never fed forward.
4. **D4 — Cost caps** (Phase D): per-study + per-session **request-count** ceiling; refuse
   on hit; no token accounting.
5. **D5 — Hosted-demo** (Phase E + small Phase D): commercial providers via visitor
   **BYO-key** (never persisted); TTL, banner, rate/conversation caps, no-signup; optional
   zero-key operator-funded vLLM model.
6. **D6 — Span-offset stability** (Phase C): index the canonical stored string, slice it to
   render, assert `quoted_text`; streaming is out of the highlight path.
7. **D7 — Launch-param bridge** (Phase B): opt-in/default-off `launch_metadata`, opaque,
   consent-disclosed, in exports; no completion loop yet.
8. **D8 — Local-mode boundary** (Phase E, docs): IndexedDB = non-syncing dev/trial/embed
   only; local-first sync would be a separate major initiative.
9. **D9 — Provenance discipline** (Phase E): record control mode, seed/first-turn, model
   config id+version per conversation; expose as export columns so analysts can stratify.

---

## 6. Risks / gotchas

- **Span-highlight stability** is the signature feature *and* the most fragile surface
  (git history shows repeated breakage atop react-markdown). Treat EVAL-3/§6.4 as a
  correctness requirement, not polish; cover with tests.
- **CRA → Vite** touches build config broadly — do it under characterization tests and
  before UX work, so polish lands on the new toolchain once.
- **Scope creep back toward image/Realtime** — both are explicitly Later. Resist
  re-adding until the success bar (§2.2) is met.
- **Supabase self-host weight** — the full stack is heavier than one container; the
  turnkey docker-compose is what keeps "clone and go" true. Keep it working.
- **Hosted-demo cost/abuse** — uncapped commercial-provider calls on a public demo are a
  real liability; resolved by the BYO-key flow + hard caps (§9 D5, MOD-8) — wire it before
  DEP-3 goes public.

---

> History: the previous broad-v1 roadmap and the Phase 0–3 execution logs are preserved
> in `PHASE0.md`–`PHASE3.md` and in git history. This file supersedes the earlier
> scope. The product spec it implements is `docs/PRD.md`.
