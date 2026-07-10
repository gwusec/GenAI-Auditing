# Phase B — Study-Config Backbone (Scope)

> Implements the PRD's MVP study-config requirements: **SC-1, SC-2, SC-3, SC-4, SC-5,
> SC-6, SC-9, SC-11, SC-13** (see `docs/PRD.md`), plus the provenance recording behind
> **D9** and the launch bridge **D7**. Sequenced as **Phase B** in `PLAN.md`.
> Goal: make the **versioned StudyConfig** the single object that fully determines the
> auditor experience (§2.1), replacing today's schema-less `study.config` blob.

## 1. Why this phase exists (current gap)

What exists today:
- `study.config` is a **free-form jsonb blob** that currently holds only
  `surveyQuestions` (authored by the existing custom `SurveyMaker`). No schema, no
  version, no control mode, no model config, no structured limits, no consent, no
  conversation count. (`src/feature0/StudySetup.jsx`, `MockStudyService.createStudy`.)
- The audit app consumes a **separate, flat runtime config** (`appProps.config` in
  `src/index.js`) with legacy array timer keys (`timerChatsMaxSeconds`, …) and the
  `llmRelay` object. (`src/tools/AppConfig.js`, `ChatTimerSystem`, `timerConfig.js`.)
- There is **no system-prompt / seed plumbing** at conversation start; conversations
  begin with the auditor's first user turn, and the relay prepends a default system
  message. `models.js` already supports a `system` author and `new_bot_message` events,
  so the seams for control modes exist.
- There is **no AuditorSession entity** — `conversations` link directly to `auditor_id`;
  there is nowhere to hang consent, progress-to-N, or `launch_metadata`.
- `supabase` `studies.status` is `draft | active | closed`; the PRD's lifecycle (SC-11)
  is `open | closed`.

Phase B closes that gap: define the StudyConfig schema, author it in the investigator
UI, and **derive the runtime config from it** for the auditor — with the two live
control modes (D2) and per-conversation provenance (D9).

## 2. In scope / out of scope

**In scope (Phase B):**
- Versioned **StudyConfig** schema + validation.
- Investigator config UI for: details, control mode (SC-2), model config (SC-3),
  limits (SC-4), conversations-per-auditor (SC-5), evaluation-method toggles (SC-6),
  optional consent text (SC-9), lifecycle open/closed (SC-11), launch-param capture
  toggle (SC-13).
- **AuditorSession** model concept (groups N conversations; holds progress, consent
  slot, `launch_metadata`).
- Auditor-side **derivation + enforcement**: StudyConfig → runtime config; enforce the
  control mode at conversation start; record provenance per conversation (D9); capture
  launch URL params (D7).
- Config **versioning**: stamp the config version onto session + conversation.

**Out of scope (other phases):**
- SurveyJS Form Library + new authoring UI tier (SC-7/SC-8) → **Phase C**. Phase B keeps
  storing whatever the questionnaire field contains and only *frames* it in the schema.
- Turn-reaction capture, consent **gate** rendering (AUD-3), span hardening → **Phase C**.
- **Server-side** limit enforcement (MOD-4) + vLLM + cost ceilings → **Phase D**. Phase B
  enforces limits client-side (as today) and records them in config.
- Supabase activation (live tables/RLS) → **Phase E**. Phase B builds against the **mock**
  study service + the in-app config; DB columns are specified here for the Phase E
  migration but not applied live.
- Arena / two-model config (SC-12) → **V1 (Phase F)**. The schema reserves `models[]` so
  adding a second entry later is non-breaking.

## 3. The StudyConfig schema (versioned)

One object, stored at `study.config`, fully determining the auditor experience. Annotated
shape (illustrative TS-ish; persisted as JSON):

```jsonc
{
  "schemaVersion": 1,                 // bumped on any breaking shape change; stamped onto sessions/conversations

  "conversationControl": {
    "mode": "seed_prompt",            // "seed_prompt" | "fixed_first_turn"  (D2; "scripted" reserved, not accepted)
    "seedPrompt": "You are a hiring assistant…",   // mode=seed_prompt: opening framing / first user prompt
    "fixedFirstTurn": null            // mode=fixed_first_turn: investigator-authored opening BOT message
  },

  "models": [                         // exactly ONE entry in MVP; a 2nd entry = Arena (SC-12, V1)
    {
      "role": "primary",
      "provider": "vllm",             // vllm | openai | anthropic | gemini  (relay support lands Phase D)
      "modelId": "org/model-name",
      "systemPrompt": "…",            // SC-3
      "decoding": { "temperature": 0.7, "topP": 0.95, "maxTokens": 1024 }
    }
  ],

  "limits": {                         // SC-4 / SC-5
    "perConversationSeconds": 600,
    "overallSeconds": 1800,
    "conversationsPerAuditor": 2,     // N; ChatTimerSystem chatDurations derives to Array(N).fill(perConversation)
    "warningSeconds": 120,            // carried through from timerConfig defaults
    "minRemainingToStartNewChatSeconds": 180
  },

  "evaluation": {                     // SC-6 — independent toggles
    "turnReactions": { "enabled": true, "types": ["thumbs", "flag", "comment"] },
    "questionnaire": { "enabled": true, "schema": { /* opaque to Phase B; SurveyJS in Phase C */ } },
    "spanHighlighting": { "enabled": true }   // taxonomy stays Later (EVAL-4)
  },

  "consent": { "text": null, "version": null },   // SC-9; null = no consent gate (gate rendering = Phase C/AUD-3)

  "launchCapture": { "enabled": false },          // SC-13 / D7; default off; consent-disclosed when on

  "lifecycle": { "state": "draft" }   // draft | open | closed (SC-11); see §4.3
}
```

**Validation rule:** a small `validateStudyConfig(config)` guard run on save and before an
auditor session starts — rejects an unknown `mode`, a missing model entry, non-positive
limits, `conversationsPerAuditor < 1`, and `mode=fixed_first_turn` with empty
`fixedFirstTurn`. A malformed config must never reach an auditor (mirrors the
validate-before-save rule for questionnaires in D1).

## 4. Data-model deltas

### 4.1 AuditorSession (new concept)
One auditor's run through one study; groups the N conversations. Fields:
`{ id, studyId, auditorId|anonymous, configVersion, expectedConversations, completedConversations, status: in_progress|complete, consentRecord?, launchMetadata?, createdAt }`.
- **Phase B:** implement in the mock/seam layer (extend `StudyService` or add a thin
  `SessionService`) and the in-app model; persisted via the mock store.
- **Phase E:** add an `auditor_sessions` table + RLS; repoint `conversations.session_id`.

### 4.2 Conversation provenance (D9)
Add to the in-app Conversation model now, and to the Phase E `conversations` migration:
`control_mode`, `seed_or_first_turn_text`, `model_config_id`, `model_config_version`
(and `config_version`). The event log already reconstructs the stimulus; these make the
condition explicit and exportable (DASH-4).

### 4.3 Lifecycle status reconciliation (SC-11)
Current DB check is `('draft','active','closed')`. Adopt **`draft | open | closed`**
(rename `active` → `open`) so the vocabulary matches the PRD; `draft` stays for
not-yet-published studies. A closed (or draft) study **accepts no new sessions**.
- Phase B: mock service uses `draft|open|closed`; `MockStudyService` default stays
  `draft`, with `open`/`close` transitions.
- Phase E: migration updates the `status` check constraint.

### 4.4 launch_metadata (D7 / SC-13)
Opaque JSON on the session, populated from the join URL's query params **only when
`launchCapture.enabled`**. Never interpreted; kept separate from audit records; included
in export (Phase E). When enabled, the consent text must disclose it.

## 5. Auditor-side derivation & enforcement

A pure `deriveRuntimeConfig(studyConfig)` maps StudyConfig → the flat object the audit
app already consumes (`AppConfig.initialize({ config })`), so the audit `<App>` needs
minimal change:
- **Limits → timer:** `timerMaxOverallChatTimeSeconds = limits.overallSeconds`;
  `timerChatsMaxSeconds = Array(limits.conversationsPerAuditor).fill(limits.perConversationSeconds)`;
  warning/min-new-chat pass through. (Matches `ChatTimerSystem`'s existing keys.)
- **Model → relay:** `models[0]` → the `llmRelay`/model-config the relay call uses
  (system prompt + decoding). In Phase B this still targets the current relay contract;
  the vLLM/provider routing is Phase D.
- **Control mode → conversation start (D2):**
  - `seed_prompt`: seed the conversation context with the opening framing (system/seed),
    then free chat.
  - `fixed_first_turn`: append an investigator-authored **`new_bot_message`** as the
    first event so the auditor sees the bot's opening message, then free chat.
  - Both keep the live model in the loop on every subsequent turn — **no bypass path.**
- **Method toggles → UI:** `evaluation.*` flags gate whether turn-reaction UI, the
  questionnaire step, and span highlighting render (the components themselves are
  hardened in Phase C; Phase B just wires the flags).
- **Provenance:** when a conversation is created, stamp `control_mode`,
  seed/first-turn text, model config id+version, and `config_version` (D9).
- **Launch capture:** on join, if enabled, read `window.location` query params into the
  session's `launchMetadata`.

## 6. Investigator config UI

Extend `StudySetup.jsx`. Today it has a 3-step stepper (Details → Questionnaire →
Share & preview). Phase B inserts a **Study configuration** step (or a set of config
cards) covering: control mode + seed/first-turn editor, model config (provider/model/
system prompt/decoding), limits + conversations-per-auditor, evaluation-method toggles,
optional consent text, the launch-capture toggle, and an **Open / Close** lifecycle
control. The questionnaire card stays (its internals are swapped in Phase C). All writes
go through `studies.updateStudy(study.id, user.id, { config })` and run
`validateStudyConfig` before persist.

> UX polish is **Phase F**; Phase B aims for functional, validated config authoring, not
> visual refinement.

## 7. Work breakdown (suggested order)

1. **Schema + validator:** `src/tools/studyConfig/schema.js` (defaults, `schemaVersion`)
   + `validateStudyConfig`. Unit-tested in isolation.
2. **Derivation:** `deriveRuntimeConfig(studyConfig)` + wire into the auditor entry so
   `AppConfig` is initialized from it. Unit-tested (limits→timer array, model mapping).
3. **Control-mode seeding:** conversation-start helper that injects seed / fixed-first
   `new_bot_message`; record provenance on the conversation. Tested against the event
   log (no live model).
4. **AuditorSession (mock):** session creation, progress-to-N, `launchMetadata`, consent
   slot; conversations link to a session.
5. **Config UI:** the new StudySetup config step + open/close control + validate-on-save.
6. **Launch capture:** read query params on join when enabled (mock/seam).
7. **Lifecycle gate:** `redeemAccessCode` / join refuses when study is `draft` or
   `closed`.
8. **Docs:** update `supabase/README.md` with the Phase E column/table deltas (status
   rename, `auditor_sessions`, conversation provenance, `launch_metadata`) so activation
   is mechanical.

Each step ships behind the existing `REACT_APP_FEATURE0` flag and keeps the default
(flag-off) app behavior unchanged.

## 8. Tests to add

- `validateStudyConfig`: accepts a good config; rejects bad mode, missing model, bad
  limits, `fixed_first_turn` without text.
- `deriveRuntimeConfig`: `conversationsPerAuditor=N` → `timerChatsMaxSeconds.length===N`;
  overall/warning mapping; model→relay mapping.
- Control-mode seeding: `seed_prompt` seeds context; `fixed_first_turn` inserts a leading
  `new_bot_message`; both leave subsequent turns live; provenance fields recorded.
- AuditorSession: created with `expectedConversations=N`; completes at N; `launchMetadata`
  captured only when enabled; absent when disabled.
- Lifecycle: join refused for `draft`/`closed`, allowed for `open`.
- Config versioning: `schemaVersion` stamped onto session + conversation.

## 9. Acceptance-criteria mapping

| Req | Covered by |
|-----|-----------|
| SC-1 create/edit study, config determines experience | §3 schema + §5 derivation + §6 UI |
| SC-2 two live control modes, enforced | §3 `conversationControl`, §5 seeding, validator rejects `scripted` |
| SC-3 model + system prompt + decoding | §3 `models[0]`, §5 model→relay |
| SC-4 per-conversation + overall limits | §3 `limits`, §5 limits→timer (server enforcement = Phase D) |
| SC-5 N conversations per auditor | §3 `conversationsPerAuditor`, §4.1 session expected/complete |
| SC-6 independent method toggles | §3 `evaluation.*`, §5 flag-gated rendering |
| SC-9 optional consent text recorded | §3 `consent` (gate rendering AUD-3 = Phase C) |
| SC-11 open/closed lifecycle | §4.3 + §7.7 join gate |
| SC-13 launch-param capture (opt-in) | §3 `launchCapture`, §4.4, §5 capture |
| D9 provenance | §4.2 conversation provenance |

## 10. Decisions (confirmed 2026-06-30)

1. **Status vocabulary →** `draft | open | closed`. The Phase E migration renames the
   existing Supabase `active` → `open`; `draft` stays for unpublished studies. The mock
   service uses this vocabulary from the start of Phase B.
2. **AuditorSession → introduced now** in the mock/seam layer (groups N conversations;
   holds the consent slot, progress-to-N, and `launch_metadata`). The `auditor_sessions`
   table + RLS land in Phase E; conversations link to a session from Phase B in-app.
3. **Config UI → extend the existing stepper** with a "Study configuration" step/cards
   (Details → Config → Questionnaire → Share). Functional-but-unpolished; visual
   refinement is deferred to the Phase F UX pass.
4. **Timer wiring → derive into the existing array shape.** `ChatTimerSystem` is left
   unchanged; `deriveRuntimeConfig` maps limits into `timerChatsMaxSeconds`
   (`Array(N).fill(perConversationSeconds)`) and `timerMaxOverallChatTimeSeconds`. No
   edits to the characterization-tested timer module.

All four are the recommended defaults; the schema in §3 and the work breakdown in §7
already reflect them, so implementation can proceed without further changes here.

## 11. Progress

- **Step 1 — schema + validator: done.** `src/tools/studyConfig/schema.js`
  (`createDefaultStudyConfig`, `withStudyConfigDefaults`, `validateStudyConfig`,
  `assertValidStudyConfig`, exported constants) + `src/tools/__tests__/studyConfig.test.js`
  (22 tests). Full suite green at 82 tests / 8 suites. Note: the default config is a draft
  skeleton with an empty `modelId` and is intentionally invalid until completed (enforces
  "a draft can't open until its config is complete").
- **Step 2 — derivation: done.** `src/tools/studyConfig/deriveRuntimeConfig.js` maps a
  StudyConfig → the flat runtime config the audit app consumes (limits → timer keys incl.
  `timerChatsMaxSeconds = Array(N).fill(perConversationSeconds)`, model block, control
  mode, evaluation toggles, consent/launch carry-through, `configVersion` provenance
  stamp). Completes partials then asserts valid before deriving. `src/tools/studyConfig/
  index.js` barrel added. `src/tools/__tests__/deriveRuntimeConfig.test.js` (11 tests).
  Full suite green at 93 tests / 9 suites.
- **Step 3 — control-mode seeding: done.** `src/tools/studyConfig/conversationControl.js`
  (`applyConversationControl`, `buildConversationProvenance`). `fixed_first_turn` injects a
  single opening `new_bot_message` (becomes the first visible turn + enters model context
  via `buildContext`); `seed_prompt` records seed framing on `conversation.controlContext`
  for the Phase D context builder and injects no visible turn. Provenance (control mode,
  seed/first-turn text, `provider:modelId`, config version) stamped for both modes. Added
  additive `provenance`/`controlContext` fields + `setProvenance`/`setControlContext` to
  `Conversation` (no regression to models characterization tests).
  `src/tools/__tests__/conversationControl.test.js` (11 tests). Full suite green at 104
  tests / 10 suites.
- **Step 4 — AuditorSession (mock): done.** New `src/tools/sessions/` seam mirroring the
  studies pattern: `SessionService` (interface), `MockSessionService` (in-memory + opt-in
  localStorage), `SupabaseSessionService` (skeleton mapping to the Phase E
  `auditor_sessions` table, inert until configured), `index.js` factory
  (`REACT_APP_SESSIONS=supabase` to switch). Sessions group N conversations, hold the
  consent slot + opaque `launchMetadata`, track progress-to-N (caps at N, flips to
  `complete`), and stamp `configVersion`. `src/tools/__tests__/sessions.test.js`
  (15 tests). Full suite green at 119 tests / 11 suites.
- **Steps 6 + 7 + 8 — done** (built together):
  - **Step 6 — launch capture:** `src/tools/sessions/launchMetadata.js`
    (`parseLaunchMetadata(search, {enabled})`) — opaque string map when enabled ({} if
    none), null when disabled; tolerates `?`-prefixed / bare strings / URLSearchParams.
    6 tests.
  - **Step 7 — lifecycle gate:** **reconciled lifecycle onto the study record's `status`**
    (removed `lifecycle` from StudyConfig; `status` is authoritative, draft|open|closed).
    Added `openStudy`/`closeStudy` to the StudyService interface + mock + Supabase impls;
    `redeemAccessCode` now refuses unless `status === 'open'` (code-validity errors still
    surface first). Feature 0 tests updated to open studies before redeeming; added gate
    + investigator-only-status tests (feature0 now 14 tests).
  - **Step 8 — Supabase deltas:** `supabase/README.md` gains a "Phase E migration deltas"
    section (status rename `active`→`open`, `redeem_access_code` open-gate, new
    `auditor_sessions` table, `conversations` provenance + `session_id` columns).
  - Full suite green at **127 tests / 12 suites**.
- **Step 5 — config UI: done.** `src/feature0/StudyConfigForm.jsx` — an MUI editor over
  the tested studyConfig backbone: control mode + seed/first-turn, model (provider/id/
  system prompt/decoding), limits, evaluation toggles (reaction-type chips), consent text,
  launch-capture toggle, live validation panel. Wired into `StudySetup.jsx` as a new
  "Configuration" step (Details → Configuration → Questionnaire → Share), preserving the
  legacy `surveyQuestions` blob, with an **Open / Close** lifecycle control in the Share
  step gated on config validity. `StudyConfigForm` added to the UI import-smoke test.
  Full suite 127/127 green **and the production Vite build compiles** (real import-graph
  check for the new UI).

### Integration pass — wiring the units into the live auditor flow

- **A — config → live app: done.** `Feature0Shell` derives the runtime config from the
  active study (`deriveRuntimeConfig(activeStudy.config)`, memoized, with a fallback for
  invalid/legacy/draft configs) and passes it as the audit `<App>`'s `config`, so the
  study's **limits drive `ChatTimerSystem`** and the control/model/evaluation blocks flow
  through. `llmRelay` is kept from `appProps` (provider routing = Phase D).
- **B — control seeding at conversation creation: done.**
  `ConversationHandler.createNewConversation(runtimeConfig)` applies
  `applyConversationControl` + persists, so `fixed_first_turn` shows the opening bot turn,
  `seed_prompt` records `controlContext`, and provenance is stamped — at runtime. `App`
  passes its `config` into creation; with no config it behaves exactly as before.
  Covered by `src/tools/__tests__/ConversationHandler.seed.test.js` (3 tests). Full suite
  **130 / 13 suites**, production build green.
- **C — AuditorSession in the live flow: pending (Phase E).** Creating a session on join
  (expected N from config), attaching conversations, recording consent, and capturing
  launch params via `parseLaunchMetadata(window.location.search, …)` belongs with Supabase
  persistence + the dashboard. The units (`sessions/`, `parseLaunchMetadata`) are built and
  tested; only the live-flow wiring waits for Phase E.
```
