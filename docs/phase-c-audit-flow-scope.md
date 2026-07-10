# Phase C — Auditor Audit-Flow Rewrite (Scope)

> The remaining Phase C work: make the auditor actually **see and use** the evaluation
> methods the investigator configured. Right now the new pieces are built + unit-tested
> but **not wired into the live auditor screen**:
> - **Turn-level reactions are not visible during chat.**
> - **The configured questionnaire is not shown in the audit** (the auditor still gets the
>   legacy matrix/principles form; a saved SurveyJS questionnaire never appears).
>
> This is the "step 5 UI" I deferred, now confirmed by live QA. It replaces the legacy
> `AuditForm` flow with a **config-driven** flow that renders the real reactions,
> questionnaire, and hardened span-highlighting.

## 1. Current state (files)

- **`src/App.jsx`** — `AppState = SURVEY | CHAT | AUDIT | COMPLETE`. Renders `ChatPage`
  (chat) and `AuditPage` (audit). Receives `config` (the derived runtime, incl.
  `config.evaluation` + `config.model`) and `presetSurveyQuestions` (legacy).
- **`src/components/ChatMessages/ChatMessages.jsx`** — renders the chat bubbles. **No
  reaction controls today.**
- **`src/pages/AuditPage.jsx` → `src/components/AuditForm/AuditForm.jsx`** — the legacy
  audit: a hard-coded state machine (`likert → highlight → text`) reading the legacy
  `surveyQuestions` shape; highlights stored as `{messageId,text,startIndex}`.
- **Already built + tested, not wired:**
  - Reactions model: `models.js` `NEW_REACTION` + `Conversation.getReactions()`,
    `tools/audit/reactions.js`, `ConversationHandler.addReaction`.
  - Questionnaire render: `components/Questionnaire/Questionnaire.jsx` (SurveyJS).
  - Audit plan: `tools/audit/auditPlan.js` (`buildAuditPlan` → `[span_highlight?, questionnaire?]`).
  - Span offsets: `tools/audit/spanHighlights.js` (canonical-string capture + assertion).
  - Config now carries `evaluation.turnReactions/questionnaire/spanHighlighting` and
    `evaluation.questionnaire.schema` (SurveyJS JSON), flowing to `App` via
    `deriveRuntimeConfig` → `Feature0Shell`.

## 2. What to build

### 2.1 Turn-reaction controls in chat (AUD-5 / EVAL-1)
On each **chatbot** message in `ChatMessages`, show the enabled reaction controls
(`config.evaluation.turnReactions.types`): 👍/👎, ⭐, 🚩, 💬-comment. Clicking calls
`conversationHandler.addReaction(conversationId, {messageId, type, value, comment})`;
current state comes from `currentReactions(conversation.getReactions())`. Hidden entirely
when `turnReactions.enabled` is false. Must not interfere with the existing selection/
highlight behavior.

### 2.2 Config-driven audit flow (AUD-6 / SC-6)
Replace the legacy 3-state machine with the **audit plan**: after end-chat, run
`buildAuditPlan(config.evaluation)` → an ordered list of `[span_highlight?, questionnaire?]`
and advance through only the enabled steps to `complete`. Turn reactions are mid-chat, not
an audit step.

### 2.3 Questionnaire step = SurveyJS (EVAL-2)
Render `config.evaluation.questionnaire.schema` with the `Questionnaire` component; capture
the native response object into the conversation's `AuditResponse` (keyed to the
conversation). This is what makes the investigator's authored questionnaire actually
appear. Fall back to nothing (skip step) if disabled or no schema.

### 2.4 Span-highlight step, hardened (EVAL-3 / D6)
Keep the highlight interaction (selecting spans in the chatbot's replies), but store
highlights in the hardened shape via `spanHighlights.createSpanHighlight` (offsets against
the canonical stored message string + `quotedText`), and resolve/verify on read. Skip the
step if `spanHighlighting.enabled` is false.

### 2.5 Data capture
Reactions → event log (done). Questionnaire responses → `AuditResponse.questionnaire`
(SurveyJS native). Highlights → hardened shape. All already reconstructable for
export/resume (AUD-8).

## 3. Approach

**Build a new `AuditFlow` component** rather than surgically editing the 490-line
`AuditForm`. `AuditFlow` owns the plan-driven step index and renders, per step, either the
highlight surface or the `<Questionnaire>`; it reads `config.evaluation`. `AuditPage`
mounts `AuditFlow` when a study config is present, and can keep `AuditForm` as a fallback
for the legacy/no-config path during transition. This isolates risk: the legacy path keeps
working while the new one is QA'd in the browser step by step.

The highlight surface is the trickiest reuse (it lives inside `AuditForm` + `ChatHistory`).
Options: (a) extract the `ChatHistory`-based highlight view into a standalone step
component, or (b) render a read-only transcript with a simpler span-selection handler that
writes hardened highlights. Decide in step 1 below.

## 4. Config flow
`config.evaluation` already reaches `App` (via `deriveRuntimeConfig` → `Feature0Shell`).
Thread it into `ChatMessages` (reactions) and `AuditPage`/`AuditFlow` (plan + schema).
`App` currently passes `surveyQuestions` (legacy); add `evaluation` + the questionnaire
`schema` alongside, and prefer them when present.

## 5. Work breakdown (each QA'd live in the browser)
1. **Reactions in chat** — add controls to `ChatMessages`, gated by config; wire
   `addReaction`; verify buttons appear + persist. (Smallest, highest-visibility.)
2. **AuditFlow skeleton** — plan-driven step container; questionnaire step first (SurveyJS
   render + capture). Verify the authored questionnaire appears and submits.
3. **Highlight step** — hardened span selection; verify highlight capture + resolve.
4. **Wire-in + gating** — `AuditPage` mounts `AuditFlow`; toggle each method in config and
   confirm steps appear/disappear; multi-conversation finish (AUD-7) + resume (AUD-8).
5. **Retire/relabel** legacy `AuditForm` path once parity is confirmed.

## 6. Risks
- This is the **signature interactive surface** and the most fragile (highlighting atop
  React-markdown has a history of breakage). Build behind the existing tests, and **QA each
  step in the browser** (now possible) rather than build-only.
- Reaction controls must not break text selection used for highlighting.
- Keep the legacy path working until the new flow reaches parity.

## 7. Decisions (confirmed 2026-06-30)
1. **Build a new `AuditFlow`** component; keep legacy `AuditForm` as fallback until parity.
2. **Reuse the existing `ChatHistory` highlighter**, extracted into a step, storing hardened
   offsets.
3. **Step order: highlight → questionnaire** (matches `auditPlan`).
4. **Inline reaction buttons** beneath each chatbot reply; 💬-comment opens an inline text
   field.

## 8. Progress
- **Step 1 — reactions in chat: built.** `ChatMessages.jsx` now renders inline
  reaction controls (👍/👎, ⭐, 🚩, 💬-comment) under each chatbot message, gated by
  `config.evaluation.turnReactions`, wired to `conversationHandler.addReaction` via the
  singletons (no prop-drilling). Comment opens an inline field. `ConversationHandler`
  keeps the active conversation in sync after a reaction. Build + suite (183) green.
  Pending live QA.
- **Step 2 — AuditFlow + SurveyJS questionnaire: built.** New `AuditFlow.jsx` shows the
  conversation transcript + renders the study's SurveyJS questionnaire
  (`config.evaluation.questionnaire.schema`) and captures responses into the conversation's
  `AuditResponse.questionnaire`, then completes. `AuditLayout` mounts `AuditFlow` when a
  schema is configured, else falls back to the legacy `AuditForm`. Build + suite (183)
  green. Pending live QA. (Highlight step = step 3; step order will be highlight →
  questionnaire once it lands.)
- **Step 2 verified live** (browser): the configured Fairness questionnaire renders in the
  audit (matrix + rating + long-text), submits, and completes into the multi-conversation
  finish prompt. Follow-up fixed: the completion summary (`ConversationHistory.jsx`) now
  renders the SurveyJS `audit.questionnaire` responses (previously showed "No audit
  responses provided" because it only read the legacy audit fields).
- **Step 3 — span-highlight step: built.** `AuditFlow` is now plan-driven
  (`buildAuditPlan` → span_highlight → questionnaire): the highlight step reuses the
  `ChatHistory` highlighter (select spans in the chatbot's replies; chips + delete), and
  on submit highlights are stored in the **hardened shape** (`migrateLegacyHighlight` →
  offsets + quotedText). `AuditLayout` now mounts `AuditFlow` for any configured study
  (`config.evaluation` present); the plan filters out a questionnaire step when no schema
  is set (no dead-end). Summary renders hardened highlights (`quotedText`). Build + suite
  (183) green. Pending live QA.
- **Steps 1–3 verified live** (browser). Bugs fixed en route: new-study auditor saw the
  legacy survey builder (`Feature0Shell` preset), debug tools visible to auditors
  (`debugMode` → `REACT_APP_DEBUG`), dashboard "Needs setup" used the legacy questionnaire
  check (`StudyDashboard` → config validity).
- **Step 4 — gating + finish/resume: gating done; resume partial.**
  - **Per-method gating (SC-6):** extracted `resolveAuditPlan(evaluation, {hasSchema})` as
    the single source of truth + unit tests for every on/off combination (13 tests). Both
    off → empty plan → auto-complete; questionnaire-without-schema dropped. Reactions gated
    in `ChatMessages`. Suite 188/188.
  - **Multi-conversation finish:** works (the "start another / finish" prompt at N).
  - **Resume:** chat + reactions rebuild from the event log; **in-progress audit**
    (highlights / partial questionnaire) is React state, lost on a mid-audit refresh —
    deeper resume needs persisted audit progress (Phase E). Documented limitation.
- **Step 5 — retire legacy: main path done.** Feature 0 studies use `AuditFlow`; the legacy
  `AuditForm` remains only as the fallback for the non-Feature-0 / demo path. Fully removing
  it (migrating the demo to a default SurveyJS config) + the tidy/long **export** of
  reactions + SurveyJS responses + hardened highlights are queued for Phase E.
- Deferred to one UI-rework pass (per your call): 8-step tutorial, reactions on the audit
  transcript, ~1-char highlight boundary, two-click PREVIEW, broader visual polish.
