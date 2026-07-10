# Phase C — Evaluation Methods (Scope)

> Implements the PRD's evaluation-capture core: **SC-7, SC-8, EVAL-1, EVAL-2, EVAL-3,
> AUD-3, AUD-5, AUD-6, AUD-7, AUD-8** and the **D1 / D6** decisions (see `docs/PRD.md`).
> Sequenced as **Phase C** in `PLAN.md`, on top of the Phase B study-config backbone.
> Goal: the auditor's judgments — in-chat reactions, a post-conversation questionnaire,
> and localized span critiques — are captured cleanly, configured per study, and exported
> in a tidy shape, with a consent gate when the study sets one.

## 1. Current state (gap)

- **Questionnaire = custom.** `src/components/SurveyMaker/SurveyMaker.jsx` authors a
  bespoke `{ questions: [{ id, type, content, settings }] }` shape; `AuditForm.jsx`
  renders it. Types: `matrix` (Likert grid), `textHighlight` (span highlighting),
  `freeResponse`. The audit flow is a hard-coded state machine in `models.js`
  (`audit_likertresponse → audit_highlight → audit_textresponse → complete`), and
  `AuditForm.getAvailableStates` maps the three types onto those states.
- **Span highlighting = custom + fragile.** Highlights render through `ChatHistory` over
  React-Markdown; each highlight is stored as `{ messageId, text, startIndex }` on
  `AuditResponse.highlights`. There is no `endOffset`, no stored canonical-vs-quoted
  assertion (the D6 correctness guard), and offsets index rendered output rather than the
  canonical event-log string.
- **Turn reactions = not built.** Only the Supabase `message_reactions` table exists
  (schema only).
- **Consent gate = not built.** `config.consent.text` is captured (Phase B) but never
  shown or recorded.
- **Multi-conversation finish/resume = partial.** The event log + `setActiveConversation`
  resume groundwork exists; it is not yet driven by `conversationsPerAuditor` from config,
  and resume must also restore the new reaction/highlight data.

## 2. In scope / out of scope

**In scope (Phase C):**
- **SurveyJS Form Library** (MIT `survey-core` + `survey-react-ui`) renders the
  post-conversation **questionnaire** from SurveyJS JSON (EVAL-2).
- **In-house authoring UI** emitting SurveyJS JSON at the D1 tier + **raw-JSON escape
  hatch**, validated against the Form Library before save (SC-7).
- **Bundled fairness + bias templates** as SurveyJS JSON (SC-8).
- **Turn-level reactions** in chat (AUD-5, EVAL-1).
- **Span-offset hardening** (EVAL-3 / D6): canonical-string offsets + `quotedText` +
  read-time assertion.
- **Consent gate** (AUD-3 / SC-9): show + record agreement when configured.
- **Multi-conversation finish driven by N** + **resume** of all evaluation data (AUD-7/8).

**Out of scope (other phases / Later):**
- **Span taxonomy** (EVAL-4) — Later; the capture model already leaves room for a `label`.
- **Pairwise/Arena** (EVAL-5) — V1 (Phase F).
- **Server-side limit enforcement / vLLM / cost ceilings** — Phase D.
- **Supabase persistence + dashboard + tidy export** — Phase E. Phase C stores into the
  existing local store + event log; the **AuditorSession** consent/launch wiring also lands
  in Phase E (Phase C records consent against the conversation/session shape it can reach).

## 3. Approach by sub-feature

### 3.1 SurveyJS questionnaire (SC-7 / EVAL-2)
- Add `survey-core` + `survey-react-ui` (MIT). Render the questionnaire step with the
  Form Library `<Survey>` model from the study's questionnaire JSON; capture the native
  response object keyed to the conversation (EVAL-2). Free-text answers verbatim.
- **Boundary (PRD):** SurveyJS covers the **questionnaire only**. **Span highlighting stays
  a custom step**, and **turn reactions stay custom** (in-chat). So the `textHighlight`
  "question" leaves the questionnaire and becomes its own configured step (SC-6 toggle);
  `matrix`/`freeResponse`/choice live inside the SurveyJS survey.

### 3.2 Audit-flow refactor (the structural change)
The hard-coded 3-substate machine is replaced by a **config-driven ordered step list**
built from `evaluation.*` (SC-6): `[ spanHighlighting?, questionnaire? ]` after end-chat
(reactions happen *during* chat). Each enabled step renders; when the list is exhausted →
`complete`. `models.js` STATE/`updateState` generalizes from "3 fixed audit states" to
"advance through the enabled steps." This is the riskiest edit (characterization-tested);
do it behind the Phase-B-style verification and keep the default (all-on) order identical
to today so existing behavior is preserved.

### 3.3 Authoring UI tier (D1)
In-house editor emitting SurveyJS JSON: single/multi choice, Likert/rating, **Likert
matrix/grid**, short/long text, page breaks, per-question instructions, required, basic
conditional visibility (`visibleIf`). Everything else via a **raw-JSON** textarea.
**Validate against the Form Library** (`new Model(json)` in a try/catch) before save.
Replaces `SurveyMaker`. Lives in the Phase B "Questionnaire" step of `StudySetup`.

### 3.4 Templates (SC-8)
Ship `src/tools/templates/fairness.surveyjs.json` and `bias.surveyjs.json` (lean on the
matrix/rating type). Adoptable + editable from the authoring UI.

### 3.5 Turn reactions (AUD-5 / EVAL-1)
In-chat affordance on each chatbot message for the enabled types
(`config.evaluation.turnReactions.types`). One record per reaction:
`{ conversation, messageId, type, value, comment?, timestamp }`. Stored as a new
event-log event type (`new_reaction`) so it lives with the immutable stimulus and survives
resume; projected to the `message_reactions` table in Phase E. (Event-log storage chosen
over a side collection so the local/event-sourced model stays the single source of truth.)

### 3.6 Span-offset hardening (EVAL-3 / D6)
Change a highlight to `{ messageId, startOffset, endOffset, quotedText, explanation?, label? }`.
Compute offsets against the **canonical stored message string** from the event log; render
highlights by **slicing that string** (not annotating rendered HTML); on read, assert
`canonical.slice(startOffset, endOffset) === quotedText` and **flag** (don't silently
render) on mismatch. Migrate the current `{ text, startIndex }` shape (startIndex→startOffset,
endOffset = startIndex+text.length, quotedText = text).

### 3.7 Consent gate (AUD-3 / SC-9)
If `config.consent.text` is set, show it before the first conversation and require explicit
agreement; record `{ version, agreed, timestamp }`. Target: the `AuditorSession.consentRecord`
(via `SessionService.recordConsent`) once sessions are wired in the live flow (Phase E);
until then record onto the first conversation so nothing is lost. No gate when consent is
absent.

### 3.8 Multi-conversation finish + resume (AUD-7 / AUD-8)
Drive the expected count from `conversationsPerAuditor` (already in the derived runtime
config); reach a finish state at N. Ensure resume rebuilds chat + reactions (event log) +
the in-progress questionnaire/highlight responses (persisted) after refresh/disconnect.

## 4. Data-model deltas

- **`AuditResponse.highlights[]`** → `{ messageId, startOffset, endOffset, quotedText, explanation?, label? }`
  (was `{ messageId, text, startIndex }`). Add a read-time assertion helper.
- **`AuditResponse.questionnaire`** → the SurveyJS native response object (replaces the
  ad-hoc `likertResponses` / `textResponses`; keep a tidy projection for export).
- **New event type `new_reaction`** in `models.js` `CHAT_EVENT_TYPE`, data
  `{ messageId, type, value, comment? }` (timestamp on the event). `getChat()` ignores it;
  a new `getReactions()` projects them.
- **Questionnaire JSON** stored at `study.config.evaluation.questionnaire.schema` (SurveyJS
  JSON), replacing the legacy `surveyQuestions` blob (with a one-time migration/escape hatch).

## 5. Work breakdown (suggested order, low-risk → high-risk)

1. **Span-offset hardening** (3.6): data shape + assertion helper + migration. Mostly pure;
   unit-testable without UI.
2. **Turn-reaction model** (3.5): `new_reaction` event + `getReactions` + `ConversationHandler`
   add/remove + config gating. Pure-ish; unit-testable.
3. **SurveyJS questionnaire render** (3.1): add deps; render `<Survey>` from JSON; capture
   responses. Component-level.
4. **Authoring UI + templates** (3.3/3.4): editor emitting JSON + validate-before-save +
   ship templates; swap into `StudySetup`.
5. **Audit-flow refactor** (3.2): generalize the STATE machine to the enabled-step list.
   *Highest risk* — do last, under the full suite, preserving default behavior.
6. **Consent gate** (3.7) + **finish/resume** (3.8): wire + verify.

Each step ships with tests + keeps the default (flag-off / all-methods-on) behavior intact,
verified by the Vitest suite + a production Vite build (the UI import-graph check).

## 6. Tests
- Span: offset/quotedText round-trip; assertion flags a mismatch; legacy-shape migration.
- Reactions: event add/remove; `getReactions` projection; disabled-type rejected; resume.
- Questionnaire: JSON validates against the Form Library; invalid JSON rejected before
  save; response captured keyed to conversation.
- Templates: both ship as valid SurveyJS JSON.
- Flow: enabled-step list built from config; finish at N; default order unchanged.
- Consent: gate shown only when configured; agreement recorded with version+timestamp.

## 7. Acceptance mapping
| Req | Covered by |
|-----|-----------|
| SC-7 authoring tier + raw JSON + validate | §3.3 |
| SC-8 fairness/bias templates | §3.4 |
| EVAL-1 turn reactions captured | §3.5 |
| EVAL-2 questionnaire responses captured | §3.1 |
| EVAL-3 / D6 span-offset stability | §3.6 |
| AUD-3 / SC-9 consent gate | §3.7 |
| AUD-5 in-chat reactions | §3.5 |
| AUD-6 end-and-audit | §3.1 + §3.2 + §3.6 |
| AUD-7 multi-conversation finish | §3.8 |
| AUD-8 resume | §3.8 |

## 8. Decisions (confirmed 2026-06-30)
1. **SurveyJS adoption → adopt now.** Add `survey-core` + `survey-react-ui` (MIT); render
   the questionnaire from SurveyJS JSON; retire the custom `SurveyMaker`/`matrix`/
   `freeResponse` rendering. Span highlighting + turn reactions remain custom.
2. **Build order → data/model first.** Span-offset hardening → turn-reaction model →
   SurveyJS render → authoring + templates → audit-flow refactor (last, highest-risk).
3. **Turn-reaction storage → event-log event** (`new_reaction`). Single source of truth;
   survives resume; projects to `message_reactions` in Phase E.
4. **Audit-flow refactor → generalize to a config-driven enabled-step list** now (needed
   for independent SC-6 toggles), done last under the full suite, preserving default order.

## 9. Progress
- **Step 1 — span-offset hardening: done.** `src/tools/audit/spanHighlights.js`
  (`createSpanHighlight` slices quotedText from the canonical string + bounds-checks;
  `highlightResolves` / `resolveHighlights` are the read-time guard tagging `resolved`;
  `migrateLegacyHighlight` converts `{messageId,text,startIndex}` → hardened shape).
  `src/tools/__tests__/spanHighlights.test.js` (9 tests). Full suite 139/139 (14 files).
- **Step 2 — turn-reaction model: done.** New `NEW_REACTION` event type + validation in
  `models.js`, `Conversation.getReactions()` projection, `src/tools/audit/reactions.js`
  (`makeReactionData`, `isReactionEnabled`, `currentReactions` last-wins/clear/comment
  semantics), and `ConversationHandler.addReaction` (appends + persists). Tests:
  `reactions.test.js` (12) + an `addReaction` glue case. Full suite 152/152 (15 files).
- **Step 3 — SurveyJS questionnaire render: done.** Added `survey-core` +
  `survey-react-ui` **v2.5.31** (MIT, React-19 compatible). `src/tools/audit/questionnaire.js`
  (`validateSurveyJSON` — validate-before-save guard, accepts object or JSON string;
  `countQuestions`); `src/components/Questionnaire/Questionnaire.jsx` renders `<Survey>`
  from JSON, captures responses on complete + change (for resume). Tests:
  `questionnaire.test.js` (7) + component import-smoke. Full suite 160/160 (17 files),
  production build resolves SurveyJS + theme CSS. **Note:** the real checkout needs
  `npm install` (two new deps).
- **Step 4 — authoring UI + templates: done.** Bundled `src/tools/templates/`
  (`fairness.surveyjs.json`, `bias.surveyjs.json`, index + `getTemplate` deep-copy).
  `src/tools/audit/authoring.js` — D1-tier helpers (`QUESTION_TYPES`, `makeQuestion`,
  immutable `addQuestion`/`updateQuestion`/`removeQuestion`/`addPage`/`removePage`).
  `src/components/QuestionnaireAuthor/QuestionnaireAuthor.jsx` — visual tier editor +
  template picker + **raw-JSON escape hatch**, both validated by `validateSurveyJSON`
  before save. Tests: `authoring.test.js` (10, incl. every tier type + both templates
  validate against the Form Library) + author import-smoke. Full suite 171/171 (19 files),
  build green. **Note:** the `StudySetup` swap (retire `SurveyMaker`) is deferred to step 5
  so the authoring format and the auditor-side renderer change together (no broken
  intermediate).
- **Step 5 — audit-flow refactor: backbone done; in-place UI rewrite pending QA.**
  - **Done (verified):** `src/tools/audit/auditPlan.js` — the config-driven enabled-step
    list (`buildAuditPlan` from SC-6 toggles → `[span_highlight?, questionnaire?]`,
    `nextAuditStep`, `isAuditComplete`). `auditPlan.test.js` (8). Suite 179/179 (20 files).
  - **Pending (needs interactive QA, not done blind):** the three *coupled* UI changes —
    (a) swap `AuditForm`'s `matrix`/`freeResponse` rendering to the SurveyJS `Questionnaire`
    component, (b) generalize the `models.js` STATE machine onto the audit plan, (c) wire
    `QuestionnaireAuthor` into `StudySetup` (retire `SurveyMaker`) saving SurveyJS JSON to
    `config.evaluation.questionnaire.schema`. These rewrite a 490-line, behaviorally-critical
    interactive flow whose data formats are incompatible (legacy `{questions:[matrix|
    textHighlight|freeResponse]}` vs SurveyJS JSON), so author + renderer must flip together.
    This sandbox can compile/import-smoke them but **cannot click-test the audit flow** — so
    they should be implemented with the app running for behavioral QA rather than shipped
    build-verified-only. The planner + `Questionnaire` + `QuestionnaireAuthor` +
    `spanHighlights` are the ready building blocks.
- Pending: step 6 (consent gate + finish/resume).
