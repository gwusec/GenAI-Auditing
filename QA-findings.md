# QA findings (live walkthrough)

Findings from driving the running app (Docker self-host, Ollama). Updated as we go.

## Resolved
- **🔴 Chat failed — "Failed to send message" / "Ollama didn't work."** Root cause: the
  relay URL was built from `REACT_APP_LLM_PROXY_HOST_AND_PORT`, which is unset at build
  time, producing `http://undefined/chat` (503 in the network tab). Nothing to do with
  Ollama — the request never reached the relay. The **Test connection** button worked
  because it uses a relative path. **Fixed:** `src/index.js` now defaults the relay base
  URL to the same origin serving the app (the self-host/Docker case). Verified: Ollama
  chat works after rebuild.
- **🔴 403 blank screen** (earlier): Vite's `crossorigin` asset tags + empty CORS
  allowlist. Fixed in `server.js` (permissive when `ALLOWED_ORIGINS` unset).
- **Model connection was unverifiable.** Added a **Test connection** button that pings the
  model through the relay and reports reachable / model-pulled / available list, with
  actionable Ollama guidance (`OLLAMA_HOST=0.0.0.0`).

## Resolved — setup page usability
- **Endless scroll → real wizard.** `StudySetup` now shows **one step at a time**
  (Details → Configuration → Questionnaire → Share) with Back/Next + a clickable step bar.
- **Configuration → collapsible sections** with plain-language titles + friendlier copy;
  advanced fields (system prompt, decoding) tucked under an "Advanced settings" toggle.
- **Model id → a picker.** Loads the provider's available models from the server
  (`/api/list-models`) into a dropdown; still type-able. Verified: shows installed Ollama
  models.
- **Limits → minutes** (not seconds).
- **Legacy "Create Your Survey" → replaced with the SurveyJS author** (templates, visual
  editor, raw-JSON). Verified: fairness template loads + saves to
  `config.evaluation.questionnaire.schema`.

## Open — MAJOR: the auditor doesn't see the configured evaluation methods
Confirmed via live QA: **turn-level reactions aren't visible during chat, and the
configured questionnaire isn't shown in the audit** (auditor still gets the legacy form).
The Phase C pieces (reactions model, SurveyJS `Questionnaire`, audit plan, hardened
highlights) are built + unit-tested but **not wired into the live auditor screen**.
→ Scoped as the **audit-flow rewrite**: `docs/phase-c-audit-flow-scope.md`.

## Resolved — audit-flow rewrite (verified live)
- **Reactions in chat** (step 1) — 👍/👎/🚩/💬 under chatbot replies, gated by config, toggle + persist. ✅
- **SurveyJS questionnaire in the audit** (step 2) — renders the configured questionnaire, submits, completes; summary shows the answers. ✅
- **Span-highlight step** (step 3) — audit runs "Step 1 of 2 · Highlight" (select text → yellow mark + removable chip, hardened offsets) → "Step 2 of 2 · questionnaire". ✅
- **New-study auditor saw the legacy "Create Your Survey" builder** — `Feature0Shell` keyed the skip-survey-builder on legacy `surveyQuestions`; now passes a non-null preset so the auditor goes straight to chat. Fixed (needs rebuild).
- **Debug tools shown to auditors** (`debugMode` hard-coded on) — now opt-in via `REACT_APP_DEBUG`. Fixed.

## Open — smaller UX
- Reactions also render on the audit transcript (highlight step); harmless but reactions are meant mid-chat.
- Highlight selection can be off by ~1 char at the boundary (legacy `ChatHistory` startIndex logic); the D6 canonical assertion resolves on save, but the live selection could be tightened.
- Local mode: conversations + timer are **global, not study-scoped** (known DEP-2 limitation) — repeated previews reuse conversations; the overall timer persists across previews.
- PREVIEW link often needs two clicks.
- **Auditor tutorial is 8 steps** (plus a second tutorial in the audit) — too long for a
  time-boxed crowd auditor.
- Dashboard **"Create & set up" button is clipped** at the card's right edge.
- Odd **floating tooltip bubbles** ("Do not include personal information"…) during chat.
- Investigator questionnaire step: the old **"Save survey and start chat" / "Skip and use
  default"** buttons are gone (replaced by the author's Save), but double-check no leftover
  auditor-language elsewhere.
