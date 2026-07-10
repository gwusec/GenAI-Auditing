# TRAILS — Audit Fix Plan & Handoff

**Date:** 2026-07-03
**Branch:** `audit-fixes` (created from `main-refactor`)
**Author of this pass:** automated audit + fix session
**Purpose:** Single source of truth for the next working session. It records (a) what the audit found, (b) what has already been fixed on this branch, (c) exactly what remains, with implementation guidance, and (d) how to verify everything. Read §0 and §1 before touching anything.

---

## 0. Read this first — state of the branch

Three things you must know before you start:

1. **Everything is uncommitted.** A stale `.git/index.lock` blocked every commit during the fix session, so all changes below live in the **working tree only**, on branch `audit-fixes`. Nothing is lost, but nothing is committed. Clear the lock first (see §2) and commit in the sequence in §9.

2. **The branch was cut from a working tree that already had large uncommitted changes.** Before this session, `git status` already showed ~100 modified/deleted files (CRA→Vite residue removal: `src/trails-chatbot/` deleted, `config-overrides.js`, `.babelrc`, `public/index.html` deleted, etc.). Those pre-existing changes are **not** part of this audit fix and were not made by this session. When you commit, stage the audit-fix files explicitly (§9) rather than `git add -A`, so the two concerns don't blur together.

3. **The code fixes are verified by the unit suite and a production build, not live.** `npx vitest run` → **193/193 pass**. `npx vite build` → compiles clean. The Docker image was **not** rebuilt, so the fixes have not been re-verified in the browser. The migration SQL (`0003`) has **not** been run against a live Postgres (no database was available in the fix environment) — it is written and reviewed but unproven.

Current status by task:

| Task | Status | Verified by |
|---|---|---|
| P0a — post-audit white-screen crash | **Done** | unit tests + build |
| P0b — relay correctness (headers, Anthropic/Gemini system, probe) | **Done** | unit tests + build + `node --check` |
| P1 — server-side API keys | **Done** | unit tests + build |
| P1b — SSRF `baseUrl` validation | **Done** | `node --check` + build |
| P2 — migration `0003` + store/code catch-up | **Partly done** | code compiles + tests; **SQL not run against a DB** |
| P3 — wire seed prompt / system prompt / decoding to the model | **Partly done** | data now reaches the relay object; **relay + context builder do not consume it yet** |
| Dashboard + tidy/long CSV+JSON export (MVP) | **Not started** | — |
| Consent gate + session wiring (MVP) | **Not started** | — |
| Join-by-link, server-side limits, hygiene | **Not started** | — |

---

## 1. The four questions this plan already answered

The direction below was chosen at the start of the fix session; keep to it unless you deliberately revisit:

- **Where do provider API keys live? → In the relay environment (server-side).** Study config only names provider/model/baseUrl. A client-supplied key is honored *only* behind `ALLOW_CLIENT_API_KEYS=true`, reserved for a future hosted BYO-key demo. This satisfies the spec invariant "no API key in the browser."
- **Session scope → P0–P3 + the migration.** Dashboard/export planned but not built in the first pass.
- **Git → fix branch + small labeled commits.** (Blocked by the lock; commit plan is in §9.)
- **Ground truth → the repo for what exists, the spec/PRD for intent.** Where they conflicted (e.g. keys-in-config), the fix moved the repo toward the spec.

---

## 2. How to resume (environment + unblock)

```bash
# 0. Clear the stale git lock (a GUI git client or a crashed process left it).
#    Close GitHub Desktop / VS Code git ops first if needed.
rm -f /Users/monicakodwani/Documents/GitHub/TRAILS-Website/.git/index.lock

# 1. Confirm you're on the fix branch with the changes present.
git -C /Users/monicakodwani/Documents/GitHub/TRAILS-Website status
git -C /Users/monicakodwani/Documents/GitHub/TRAILS-Website branch --show-current   # -> audit-fixes

# 2. Install + run the checks the fixes were verified against.
cd /Users/monicakodwani/Documents/GitHub/TRAILS-Website
npm install
npx vitest run          # expect: 193 passed
npx vite build          # expect: clean compile (one big-chunk warning is fine)
```

> Sandbox note for the next automated session: on ARM Linux you must add the platform-native binaries once — `npm install --no-save --force @rollup/rollup-linux-arm64-gnu @esbuild/linux-arm64` — or Vitest/Vite fail to load rollup. Not needed on the user's Mac.

To re-verify live (recommended before merging): rebuild the Docker image and repeat the QA script in §8.

```bash
docker compose up --build      # serves app+relay on http://localhost:3030
```

---

## 3. What was fixed — detail, with rationale and verification

Each item below says: **the problem**, **the root cause**, **the fix**, **the files**, and **how to check it**.

### P0a — Post-audit white-screen crash  *(Done)*

- **Problem (found live):** completing a configured study's audit saved the data, then blanked the whole app. Console: `TypeError: Cannot read properties of undefined (reading 'length')`.
- **Root cause:** `AuditFlow` saves highlights in the **hardened** shape (`{quotedText, startOffset, endOffset}`) via `migrateLegacyHighlight`. The completion summary re-renders them through the **legacy** `ChatHistory`, which reads `highlight.text.length` and `highlight.startIndex` — both `undefined` on the hardened shape → crash inside a `useState` initializer.
- **Fix:** added `toRenderableHighlight(h)` to `src/tools/audit/spanHighlights.js` — normalizes *either* shape to the render shape (`{...h, text, startIndex}`), never yielding an undefined `text`/`startIndex`. `ChatHistory` now normalizes its `highlights` prop once at the top and uses that everywhere (render, overlap-check).
- **Files:** `src/tools/audit/spanHighlights.js`, `src/components/ChatHistory/ChatHistory.jsx`, `src/tools/__tests__/spanHighlights.test.js` (3 new regression tests).
- **Check:** `npx vitest run src/tools/__tests__/spanHighlights.test.js` → 12 passed. Live: finish an audit with a highlight → summary renders instead of white-screening.

### P0b — Relay correctness  *(Done)*

Three separate bugs in `server/server.js` + one in the client:

- **`res.headerSent` typo** → the double-send guard never fired; a late upstream error after a 408 timeout threw `ERR_HTTP_HEADERS_SENT`. Fixed to `res.headersSent` in both catch blocks.
- **Anthropic system message** → the code sent `role:"system"` inside `messages`, which the Anthropic API rejects. Now the system text is extracted and passed as the top-level `system` param; `messages` carries only user/assistant turns.
- **Gemini system message** → was silently remapped to a `model` turn. Now passed as `systemInstruction`. Cohere similarly gets `preamble`.
- **`APIClient` "Are you down?" probe** → on any non-400 error it fired a *second real upstream model call*, and its success check tested a misspelled `statuCode`, so it could never return anyway. Removed. Error logging now logs `err.message` + status only, instead of the full axios error (whose `config.data` embedded the relay object).
- **Files:** `server/server.js`, `src/tools/APIClient.js`.
- **Check:** `node --check server/server.js`; `npx vitest run src/tools/__tests__/APIClient.test.js` → 3 passed.

### P1 — Server-side API keys  *(Done — the security-critical fix)*

- **Problem:** keys were typed into the config UI ("Stored with this study"), saved into `studies.config` (→ Postgres), and shipped to **every auditor's browser** inside `config.llmRelay`. Any joined auditor could read the deployer's OpenAI/Anthropic/Gemini key from DevTools.
- **Fix (relay):** `server/server.js` now resolves keys from env via `resolveApiKey(provider, clientKey)` — server env first (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `COHERE_API_KEY`, `VLLM_API_KEY`); a client key is used only if `ALLOW_CLIENT_API_KEYS=true`. `/chat`, `/api/test-api-key`, `/api/test-model`, `/api/list-models` all use it and return a clear "set `X_API_KEY` in the relay env" message when a required key is missing.
- **Fix (client):** `apiKey` removed from the StudyConfig model shape (`schema.js`), from the relay wire object (`deriveRuntimeConfig.modelToRelay`), and from the config form (the password field is replaced by an info panel naming the env var, e.g. `OPENAI_API_KEY`). `withStudyConfigDefaults` now **scrubs** any legacy stored `apiKey` on load, so a load→save cycle removes keys already sitting in existing configs. The validator no longer requires an `apiKey`.
- **Fix (ops):** `OPENAI_API_KEY` … `VLLM_API_KEY` + `ALLOW_CLIENT_API_KEYS` documented in `.env.example` and `self-host/.env.selfhost.example`, and passed through in `docker-compose.yml` and `self-host/docker-compose.trails.yml`.
- **Files:** `server/server.js`, `src/tools/studyConfig/schema.js`, `src/tools/studyConfig/deriveRuntimeConfig.js`, `src/feature0/StudyConfigForm.jsx`, `.env.example`, `self-host/.env.selfhost.example`, `docker-compose.yml`, `self-host/docker-compose.trails.yml`, plus updated tests in `studyConfig.test.js` and `deriveRuntimeConfig.test.js`.
- **Check:** tests assert (1) a cloud provider validates **without** a key, (2) `withStudyConfigDefaults` strips a legacy `apiKey`, (3) the relay object never carries `apiKey`. All green.
- **⚠ Follow-up:** any **already-saved** study configs (mock localStorage or a live Supabase `studies.config`) may still contain a plaintext key until they're re-saved. See §5 "Data hygiene" for a one-time scrub.

### P1b — SSRF `baseUrl` validation  *(Done)*

- **Problem:** Ollama URLs were private-host-checked, but the `api` backend's `baseUrl` was completely unvalidated — the relay would POST to `http://169.254.169.254/…` or any internal host a caller supplied.
- **Fix:** `validateApiBaseUrl()` in `server/server.js` mirrors `validateOllamaUrl` (http/https only; blocks private/loopback/link-local hosts in production) behind a new `ALLOW_PRIVATE_API_URLS` flag (set `true` for a LAN vLLM). Applied on `/chat`, `/api/test-api-key`, `/api/test-model`, `/api/list-models`.
- **Files:** `server/server.js`, `.env.example`, both compose files.
- **Check:** `node --check server/server.js`. (Consider adding a small supertest-style unit test — see §6.)
- **Still open (CORS):** the relay still defaults to allow-all origins when `ALLOWED_ORIGINS` is unset, and both compose files leave it unset/`*`. Not changed here to avoid breaking same-origin asset loading; tighten before a public deployment (§5).

### P2 — Migration `0003` + store catch-up  *(Partly done — SQL unproven)*

- **Problem:** the app writes `status='open'`, targets an `auditor_sessions` table and session RPCs, and expects conversation provenance columns — none of which exist in `0001`/`0002`. Opening a study against the committed schema fails on the check constraint. Also two RLS write-policy holes and weak access codes.
- **Fix (SQL):** new `supabase/migrations/0003_lifecycle_sessions_provenance.sql`:
  1. `studies.status` vocabulary → `draft|open|closed` (migrates existing `active`).
  2. `redeem_access_code` now **refuses unless the study is open** (SC-11).
  3. new `auditor_sessions` table + RLS (owner writes only within a study they're a member of; investigators read their study's sessions).
  4. `conversations` provenance columns: `session_id`, `control_mode`, `seed_or_first_turn_text`, `model_config_id`, `model_config_version`, `config_version`.
  5. **write-side RLS tightening**: `conversations`/`message_reactions` inserts now require `is_study_member(study_id, auth.uid())`, closing the cross-study write hole.
  6. session helper RPCs `attach_conversation_to_session`, `complete_session_conversation` (SECURITY DEFINER with ownership checks).
- **Fix (code):** `SupabaseStore` now maps the provenance columns both ways (so `seed_prompt` context + provenance survive a reload against Supabase). Access codes are now crypto-random 10-char (unambiguous alphabet, ~50 bits) in **both** `SupabaseStudyService` and `MockStudyService`, replacing 6-char `Math.random` base36.
- **Files:** `supabase/migrations/0003_lifecycle_sessions_provenance.sql` (new), `supabase/README.md` (marked implemented), `src/tools/stores/SupabaseStore.js`, `src/tools/studies/SupabaseStudyService.js`, `src/tools/studies/MockStudyService.js`.
- **⚠ Must do before trusting this:** run all three migrations against a real Supabase (Studio SQL editor or `psql`), in order, then run the isolation checks in §8. The SQL is reviewed but **unexecuted**.

### P3 — Wire seed / system prompt / decoding  *(Partly done — NOT functional yet)*

- **What's done:** `modelToRelay` now includes a `decoding` object on the relay wire contract (both ollama and api backends), so the study's temperature/top_p/max_tokens now *reach* the relay object.
- **What's NOT done (do this next — see §4.1):** the relay still **hardcodes** `temperature: 0.7` / `max_tokens: 2000` (api) and `num_predict: 2000` (ollama) and **ignores** `relay.decoding`. And nothing prepends the study's **system prompt** or **seed_prompt** to the model context — `ConversationHandler.buildContext` still builds only from chat events, so `controlContext.seedPrompt` and `model.systemPrompt` remain inert (exactly the audit's Gap #4). **Until this is finished, a study's framing and decoding settings still have no effect on the model.**

---

## 4. What remains — ordered, with implementation guidance

### 4.1 Finish P3: make the model actually use the study's framing + decoding  *(highest priority — correctness)*

This is a research-validity issue: a bias-audit study that sets a system prompt or seed currently gets ignored, and the model is silently told "You are a helpful assistant."

1. **Relay honors decoding.** In `server/server.js`, read `relay.decoding` and apply it. For `api`: `temperature: decoding.temperature ?? 0.7`, `max_tokens: decoding.maxTokens ?? 2000`, `top_p: decoding.topP` (map to each provider's field — `top_p` for OpenAI/vLLM, `top_p` in Anthropic, `topP` in Gemini `generationConfig`). For `ollama`: `options: { temperature, top_p, num_predict: maxTokens }`.
2. **System prompt reaches the model.** `deriveRuntimeConfig` already exposes `model.systemPrompt`. Put it on the relay object (e.g. `relay.systemPrompt`) and have the relay prepend a `{role:'system', content: systemPrompt}` when the caller didn't supply one — **replace** the current hardcoded "You are a helpful assistant." default so it only applies when there's neither a study system prompt nor an inline system message.
3. **Seed prompt (seed_prompt mode).** `Conversation.controlContext.seedPrompt` is recorded but never used. Decide the mechanism and document it: simplest is to treat a non-empty seed as the system prompt for that conversation (prepend at context-build time in `ConversationHandler.buildContext`, or pass through the relay). Keep the model live on every turn (no bypass) — that invariant still holds.
4. **Tests:** extend `deriveRuntimeConfig.test.js` (systemPrompt/decoding on the relay object — partially there) and add a relay-level unit test (see §6) asserting the outgoing provider body carries the configured temperature and system text.

### 4.2 Dashboard + tidy/long CSV & JSON export  *(largest MVP gap — blocks external use)*

Investigators currently cannot see or extract collected data. Build:

- **Session/conversation list** (DASH-1) reading `conversations` for the study (RLS already grants investigators SELECT). Per-session drill-down (DASH-2). Basic aggregates — flag counts, Likert distributions (DASH-3).
- **Export module (do this as a pure, tested function first):** one row per observation (reaction / questionnaire answer / highlight), each row carrying provenance columns from `conversation.provenance` (`control_mode`, `seed_or_first_turn_text`, `model_config_id`, `config_version`). Emit **CSV and JSON from the same projection** so they can't disagree. Quote embedded newlines/commas for R's `read_csv`. Suggested location: `src/tools/export/toTidyRows.js` + `toCsv.js`, with a unit test that round-trips a fixture conversation and asserts CSV⇄JSON agree.
- **Wire a per-study "Export" button** on the dashboard once the projector exists.

### 4.3 Consent gate + session lifecycle  *(MVP)*

- **Consent gate:** when `runtimeConfig.consent.text` is set, render a gate before chat that records `{version, timestamp, agreed}`. Nothing renders consent today.
- **Session wiring:** call `SessionService.createSession` on `joinWithCode`/`previewStudy`, record consent, attach conversations, increment completion. `SupabaseSessionService` is ready for the `0003` tables; wire it into `Feature0Context`.
- **Launch capture (SC-13):** when `launchCapture.enabled`, store opaque `?PROLIFIC_PID=…` on the session (`launch_metadata`), consent-disclosed. Helper exists (`sessions/launchMetadata.js`); it's not called from live code.

### 4.4 Join-by-link + server-side limits  *(MVP)*

- **Join by link:** accept a `?code=…` param on the gate and auto-fill/redeem — no router needed.
- **Server-side enforcement (MOD-4/MOD-7):** the relay enforces only per-IP rate limits. Add per-study/per-session request-count ceilings; refuse on hit. `conversationsPerAuditor` and time limits are currently client-only.

### 4.5 Hygiene  *(low risk, high tidiness — clears self-host friction)*

- Commit `package-lock.json` and switch CI back to `npm ci` (CI currently uses non-reproducible `npm install` because the lockfile is gitignored).
- Untrack `.env`; **rotate the committed self-host `JWT_SECRET`/anon key** (`self-host/.env` currently holds a real anon JWT → implies an unrotated demo secret).
- Delete dead legacy components (`src/components/adapters/*`, `APIKeySetup`, `LLMSelector`, `WebLLMSetup`, `OllamaSetup`, `ChatService`, `BackendStatus`) and `build_log.txt`. (These need a manual `git rm`/`rm` on the real checkout — the sandbox can't delete files.)
- Rewrite `README.md` (still describes the pre-Feature-0 app, dev ports, embed API) and fix `package.json` `main` shipping raw JSX (a V1 library-build concern).
- Add `build/` to `.gitignore` (a stray `build/` was produced during verification).

### 4.6 Append-only persistence  *(risk, not a gap)*

`SupabaseStore` rewrites the whole `chat_events` array on every update (last-write-wins) — two tabs or a retry can clobber events. Consider an `append_chat_event` RPC or per-event rows. Not urgent for single-auditor sessions.

---

## 5. Security & data-hygiene follow-ups (do alongside P1)

- **Scrub existing stored keys.** The code now strips `apiKey` on the next save, but existing rows keep their key until then. One-time cleanup:
  - Mock/local: clear or re-save studies (localStorage key `trails_mock_studies`).
  - Supabase (once live): `update public.studies set config = config #- '{models,0,apiKey}' where config #> '{models,0,apiKey}' is not null;` (adjust for multi-model when Arena lands).
- **Fail-closed CORS** in production: set `ALLOWED_ORIGINS` to the exact app origin in both compose files before any public deploy.
- **Rotate the self-host Supabase secrets** committed in `self-host/.env` (§4.5).

---

## 6. Test coverage added / still to add

**Added this pass (all green):** `toRenderableHighlight` (3 cases incl. the crash guard); server-side-keys behavior in `studyConfig.test.js` (validate-without-key, legacy-key scrub); relay-object-has-no-apiKey + decoding-carried in `deriveRuntimeConfig.test.js`.

**Recommended next:**
- Relay unit tests (supertest against the Express app): missing-server-key → 400 with the env-var message; `baseUrl` pointing at a private host → blocked; Anthropic body puts system text in `system` not `messages`; decoding values flow into the provider body (guards §4.1).
- Export projector round-trip test (CSV⇄JSON agreement) once §4.2 exists.
- A migration smoke test against a disposable Postgres (supabase CLI local) asserting cross-study isolation under a join.

---

## 7. Full change inventory (this branch, uncommitted)

**New files**
- `supabase/migrations/0003_lifecycle_sessions_provenance.sql`
- `docs/AUDIT-FIX-PLAN.md` (this document)

**Modified — application/relay**
- `server/server.js` — server-side key resolution, SSRF `baseUrl` validation, provider-correct system-message handling, `headersSent` fix.
- `src/tools/APIClient.js` — removed the upstream probe; safe error logging.
- `src/components/ChatHistory/ChatHistory.jsx` — normalize highlight shape (crash fix).
- `src/tools/audit/spanHighlights.js` — `toRenderableHighlight`.
- `src/tools/studyConfig/schema.js` — drop/scrub `apiKey`, `keyEnv` metadata, no key validation.
- `src/tools/studyConfig/deriveRuntimeConfig.js` — no `apiKey` on the relay object; carry `decoding`.
- `src/feature0/StudyConfigForm.jsx` — replace key field with server-env info panel.
- `src/tools/stores/SupabaseStore.js` — map `0003` provenance columns both ways.
- `src/tools/studies/SupabaseStudyService.js`, `src/tools/studies/MockStudyService.js` — crypto-random access codes.

**Modified — ops/docs**
- `.env.example`, `self-host/.env.selfhost.example` — provider key + SSRF/BYO-key vars.
- `docker-compose.yml`, `self-host/docker-compose.trails.yml` — pass provider keys + `ALLOW_PRIVATE_API_URLS`.
- `supabase/README.md` — mark the Phase-E deltas implemented.

**Modified — tests**
- `src/tools/__tests__/spanHighlights.test.js`, `studyConfig.test.js`, `deriveRuntimeConfig.test.js`.

> Reminder: the branch also contains **pre-existing** uncommitted changes (CRA→Vite residue removal) that predate this session — don't attribute them to the audit fix.

---

## 8. Verification checklist

**Static (green now):** `npx vitest run` → 193 passed · `npx vite build` → clean · `node --check server/server.js` → OK.

**Live (after `docker compose up --build`) — re-run the QA that found the crash:**
1. Investigator → open a study with span highlighting **and** a questionnaire → **Preview**.
2. Chat (Ollama), react (👍/🚩) on a bot reply, **End Conversation**.
3. Highlight a phrase → **Continue** → answer the questionnaire → **Complete**.
4. **Expect the completion summary to render** (previously white-screened). Confirm the saved highlight and questionnaire answers appear.
5. Config form: pick OpenAI → confirm the key field is gone, replaced by the "set `OPENAI_API_KEY` on the server" panel.
6. With `OPENAI_API_KEY` set in the relay env, run **Test connection** → succeeds without any key in the browser; inspect the `/chat` network payload → **no `apiKey`** in the relay object.

**Supabase (after applying `0001`→`0002`→`0003`):** create study → open (status flips to `open`, no constraint error) → generate code → redeem in an incognito session → audit runs → rows land in `conversations`/`auditor_sessions` → a second investigator cannot see the first's studies, **including** through a `conversations`⋈`studies` join.

---

## 9. Commit sequence (once the lock is cleared)

Stage explicitly per concern so the audit fix stays separable from the pre-existing tree changes:

```bash
# 1. crash fix
git add src/tools/audit/spanHighlights.js src/components/ChatHistory/ChatHistory.jsx \
        src/tools/__tests__/spanHighlights.test.js
git commit -m "Fix post-audit white-screen: normalize hardened highlights for the legacy renderer"

# 2. relay correctness
git add server/server.js src/tools/APIClient.js
git commit -m "Relay: fix headersSent guard, provider-correct system messages, drop upstream probe"

# 3. server-side keys
git add src/tools/studyConfig/schema.js src/tools/studyConfig/deriveRuntimeConfig.js \
        src/feature0/StudyConfigForm.jsx .env.example self-host/.env.selfhost.example \
        docker-compose.yml self-host/docker-compose.trails.yml \
        src/tools/__tests__/studyConfig.test.js src/tools/__tests__/deriveRuntimeConfig.test.js
git commit -m "Move provider API keys server-side (relay env); strip keys from study config + browser"

# 4. SSRF (already in server.js from step 2 if not yet committed — otherwise skip)
#    (validateApiBaseUrl lives in server/server.js; commit with step 2 or separately)

# 5. migration + store catch-up
git add supabase/migrations/0003_lifecycle_sessions_provenance.sql supabase/README.md \
        src/tools/stores/SupabaseStore.js src/tools/studies/SupabaseStudyService.js \
        src/tools/studies/MockStudyService.js
git commit -m "Add 0003 migration (lifecycle/sessions/provenance/RLS) + crypto access codes + store mapping"

# 6. this plan
git add docs/AUDIT-FIX-PLAN.md
git commit -m "Add audit fix plan / handoff doc"
```

(Note: `validateApiBaseUrl` and the key changes both live in `server/server.js`, so steps 2–4 touch the same file — commit `server/server.js` once, with a message covering relay correctness + SSRF + server-side keys, rather than splitting mid-file.)

---

## 10. One-paragraph status for a standup

The security-critical and crash fixes are done on branch `audit-fixes` and pass the full unit suite (193) and a production build, but are **uncommitted** (a stale `.git/index.lock` blocked commits) and **not yet re-verified live**. Provider API keys now live in the relay environment instead of study config and the browser; the post-audit white-screen crash is fixed; the relay's Anthropic/Gemini system-message handling, a header-guard typo, and an accidental double-call probe are fixed; SSRF validation now covers cloud `baseUrl`s; and migration `0003` (lifecycle vocab, `auditor_sessions`, provenance columns, RLS write-side tightening, crypto access codes) is written but **unapplied to any database**. The biggest remaining items are: finish wiring the study's system/seed prompt and decoding into the actual model call (currently the data reaches the relay object but the relay still ignores it), and build the investigator dashboard + tidy/long CSV/JSON export — without which external groups can't get their data out.
