# Phase 1B — Live QA Findings (shadcn/ui + Tailwind migration)

**Build tested:** Docker from branch `worktree-phase-1b-shadcn` (commit `1aef3fe`), served at
`localhost:3030`. **Verified MUI-free:** live DOM check returned 0 `Mui*`/emotion `css-`
elements and 0 `style[data-emotion]` tags; Tailwind utility classes present. **Date:** 2026-07-10.

Hand this file to the terminal (Claude Code) to fix. Items are grouped by severity with repro
steps and likely file pointers. Pointers are best-guess from the QA session; confirm in code.

---

## Resolution status (2026-07-10, terminal — branch `worktree-phase-1b-shadcn`, PR #2)

| Item | Status | Notes |
|------|--------|-------|
| **B4** — Preview audit view doesn't render | ✅ **Fixed + verified live** | Root cause was **not** what the note assumed (see below). Preview now renders the config-driven `AuditFlow`; the SurveyJS questionnaire renders and is teal-themed. |
| **B1** — indigo/purple chat top bar | ✅ **Fixed + verified live** | Broader than reported: ~24 stale `--mui-palette-*` refs across 6 CSS modules re-bridged to the new tokens. Chat header now teal (`rgb(13,150,139)`). |
| **B3** — timer countdown | ✅ **Verified (not a bug) + polish added** | The timer **does** count down (observed 4→3 min live). The demo's "static" string was stale persisted `chatTimerState`. Added a "No time limit" display for genuinely-unconfigured studies. |
| **B2** — condense tutorial | ⏸️ **Deferred** (ROADMAP Phase 6) | Larger UX change; needs content decisions. Not done in this pass. |

**Corrected diagnosis for B4.** Both demo and Preview render `<App>` → `AuditPage` → `AuditLayout`,
which chooses `AuditFlow` when `config.evaluation` is set, else the legacy `AuditForm`. The QA note
had the mapping **reversed**: the *demo* uses `AuditForm` (its config has no `evaluation`) + the
built-in questionnaire — the "shadcn Table" QA saw is the migrated `AuditForm`, not `AuditFlow`.
Preview *should* use `AuditFlow`, but `Feature0Shell` wrapped `deriveRuntimeConfig(study.config)` in a
**silent `catch → base`**; when the study config failed strict validation (incomplete draft / schema
drift), it dropped to `base` (no `evaluation`) → the legacy `AuditForm` mounted with an empty
questionnaire → blank audit (the "Initializing audit form…" console line). **Fix:**
`deriveRuntimeConfig` gained a `strict` option; `Feature0Shell` now derives leniently (and logs the
reason) on validation failure so `evaluation` + the questionnaire schema survive → Preview reliably
reaches `AuditFlow`.

**Live re-verification (Chrome, FEATURE0 dev build):** investigator account → study → saved the
*Fairness audit* questionnaire → **Preview as auditor** → End Conversation & Start Reporting →
**`AuditFlow` renders** ("STEP 1 OF 2 · Highlight anything problematic" → "STEP 2 OF 2 · Fairness
audit" **SurveyJS** form, `sd-root-modern`). `--sjs-primary-backcolor` resolves to `rgb(13,150,139)`
(teal) — the Phase 1B `--sjs-*` bridge is themed. No console errors; no "Initializing audit form"
(legacy path gone). Suite: **233 tests** green, `vite build` clean.

**Files touched:** `src/tools/studyConfig/deriveRuntimeConfig.js` (+`strict` option),
`src/feature0/Feature0Shell.jsx` (lenient derive + logging), `src/tools/__tests__/deriveRuntimeConfig.test.js`
(new strict test); B1: `src/App.module.css`, `src/components/{ChatBox,ChatMessages,ConversationHistory,MessageForm,LoadingDots}/*.module.css`;
B3: `src/App.jsx` (timer format helpers).

### Still to re-QA in the Cowork chat
- **B4 with a strict-invalid config** — my live repro used a fully-valid study (the UI gates preview
  on a saved questionnaire). The lenient fallback for a config that *fails* `assertValidStudyConfig`
  is covered by a unit test + code, but worth one Cowork pass with a deliberately-incomplete draft to
  confirm it reaches `AuditFlow` rather than the blank legacy form.
- **B1 in dark mode** — the re-bridged CSS-module surfaces now follow the theme; confirm the chat/
  reporting/history surfaces look right in dark mode (previously the static fallbacks didn't respond).
- **B3 "No time limit"** — only renders for a study with no configured timer; confirm copy/placement.

---

## Bugs to fix

### B1 · Stray indigo/purple top bar on the chat screen  ·  Severity: minor (visual)  ·  ✅ FIXED
The auditor **chat** screen ("Conversation") renders its top app-bar in **indigo/purple**,
which is off-palette. The teal accent is used everywhere else, and the **Reporting** screen's
top bar is navy/blue — so the chat bar is inconsistent with both.
- **Repro:** Demo → chat screen; observe the top "Conversation" bar color vs the teal buttons
  and vs the blue "Reporting" bar after ending the conversation. **Also confirmed in
  investigator Preview** (not demo-only), so it's the chat screen's top bar generally.
- **Root cause (confirmed):** `ChatBox.module.css` set the header to
  `var(--mui-palette-primary-main, #4f46e5)`. MUI's `cssVariables` used to define
  `--mui-palette-*` on `:root`; Phase 1B removed MUI, so the var is gone and `var()` fell back
  to the hardcoded `#4f46e5` (indigo-600). The CSS modules were never re-bridged to the new
  tokens — a whole class of this: ~24 refs across 6 modules.
- **Fix (done):** replaced every `var(--mui-palette-*, …)` with the matching design token
  (`hsl(var(--primary))`, `hsl(var(--card))`, `hsl(var(--border))`, …). Chat header now teal and
  the affected surfaces follow light/dark. Verified live: computed bg `rgb(13,150,139)`.

### B2 · Onboarding tutorial is long and repeats at every step  ·  Severity: UX (known item)  ·  ⏸️ DEFERRED
The multi-step tutorial fires on the chat screen **and** again on each audit sub-step
(questionnaire showed ~3 modal steps; the highlight step has its own). It's the known
"condense the 8-step tutorial" item — reconfirmed on this build.
- **Repro:** Demo → click through; count the modal steps across chat → questionnaire →
  highlight.
- **Tracked in:** PLAN.md §5 (MVP polish) and ROADMAP Phase 6. Elevated here as a concrete
  fix target: condense to a short, skippable, once-per-session tutorial (don't re-prompt at
  every audit sub-step).
- **Likely files:** `src/components/tutorials/*` (`ChatBoxTutorial`, `AuditPage0/1/2Tutorial`)
  and wherever they're triggered in the chat/audit flow.
- **Decision:** deferred — larger than the other three and it's Phase-6 scoped (needs content
  decisions on which steps to keep + skip affordance). Not done in this pass.

### B3 · Verify the runtime timer actually counts down  ·  Severity: needs-investigation  ·  ✅ VERIFIED (not a bug)
The chat sidebar shows "Time remaining: **less than 1 minute**" on this build (the old MUI
build showed "no time"). Behavior differs between builds; unclear whether the countdown is
actually running or just displaying a static string.
- **Repro:** Demo → chat; watch the "Time remaining" line in the left sidebar over ~30s.
- **Finding (confirmed live):** the timer **does** count down — observed "4 minutes" → "3 minutes"
  live. The variability across builds is stale persisted `chatTimerState` in localStorage (a prior
  configured-study session left `currentChatIndex: 13` etc.), which is the pre-existing DEP-2
  "study-scoped local timer" issue, not a 1B regression. Demo's own config has empty timer arrays →
  a truly-unconfigured timer yields `NaN`/`0`.
- **Polish (done):** the sidebar now shows **"No time limit"** (and hides the progress bar) when the
  timer is unconfigured (`NaN`), instead of the misleading "less than 1 minute". Configured studies
  count down as before.
- **Files:** `src/App.jsx` (`hasTimeLimit` / `formatTimeRemaining` helpers).

### B4 · Investigator Preview: "End Conversation & Start Reporting" doesn't render the audit view  ·  Severity: high (blocks audit in Preview)  ·  ✅ FIXED + verified live
In **investigator Preview** ("Preview as auditor" on a configured study), clicking **End
Conversation & Start Reporting** advances the app state but the audit/reporting UI never
renders — the screen stays on the chat.
- **Console evidence:** logs show `Transitioning app state to AUDIT`, `update conversation
  state to audit likert response`, and `Initializing audit form...` — i.e. state moves to
  AUDIT but the view doesn't mount.
- **Corrected root cause:** the demo/Preview mapping is the reverse of the note's assumption
  (see "Resolution status" above). Preview fell to the legacy `AuditForm` because
  `Feature0Shell` silently swallowed a `deriveRuntimeConfig` validation failure and dropped
  `evaluation`. **Fixed** by deriving leniently on failure so Preview reaches `AuditFlow`.
- **Repro:** Sign in → study → Preview as auditor → send a message → End Conversation & Start
  Reporting → **now renders `AuditFlow`** (span highlight → SurveyJS questionnaire).
- **Files:** `src/feature0/Feature0Shell.jsx`, `src/tools/studyConfig/deriveRuntimeConfig.js`.
- **Impact:** **unblocked** the live SurveyJS-render verification — SurveyJS now renders in
  Preview and is `--sjs-*`-themed (teal). See "Live re-verification" above.

---

## Verified working on the shadcn build (parity confirmed)

- **Landing** (light + dark), theme toggle persists; tab pills, join-study card, inputs.
- **Investigator auth**: Sign in / Create account segmented tabs; **error alert renders
  correctly** (shadcn destructive style — "Invalid email or password").
- **Demo chat**: user/bot bubbles, avatars, principles chips ("+6 more"), composer.
- **Audit — questionnaire**: rendered as a **shadcn Table** (`class="w-full caption-bottom
  text-sm"`); matrix radios select correctly; "Next" gates until answered.
- **Audit — highlight step**: renders with its example tutorial.
- **Investigator (signed in on the rebuilt backend)**: dashboard (study cards, badges, teal
  top bar), study **setup stepper** (4 steps, teal checkmarks), Details/Configuration/
  Questionnaire/Share & preview, provider **Select**, Ollama connector; **Preview as auditor**
  launches and the **Ollama model responds live** with turn-reaction icons.
- **DOM**: MUI-free (0 `Mui*`/emotion), Tailwind utilities present.

## Questionnaire renderer — clarification (answers "SurveyJS or in-house?")
In the **demo**, the questionnaire is the **in-house** questionnaire, now rendered with a
**shadcn Table** — **not** SurveyJS (0 `sd-`/`sv-` elements, no `--sjs-*` vars). This is
expected: the demo path uses the legacy `AuditForm` (its config has no `evaluation`), whose
matrix is the migrated MUI Table → shadcn Table. A schema-configured **study** uses `AuditFlow`,
which renders the SurveyJS `<Questionnaire>` (confirmed live — see Resolution status). **Not a bug.**

---

## Environment note (not a code bug) — worktree build had no backend
Investigator sign-in failed for **both** the QA agent and the user with "Invalid email or
password", and the sign-in made **no network request** — i.e. the build was running in
local/Mock auth, not Supabase. Cause: the `worktree-phase-1b-shadcn` worktree had **no `.env`**
(env files are gitignored, so they don't follow a new worktree), and `docker-compose.yml` reads
the Supabase build args from a `.env` next to it (`${REACT_APP_SUPABASE_URL:-}`) — so the Docker
build baked **empty** Supabase URL/anon key. **Fix applied:** copied the main `.env` into the
worktree; rebuild with `docker compose up --build` from the worktree so `REACT_APP_*` (build-time)
are compiled in. **Gotcha for future worktree builds:** copy `.env` into the worktree before
building.

## Still to verify (was blocked by B4 — now UNBLOCKED)
- **SurveyJS render path**: ✅ confirmed live after the B4 fix — for a schema-configured study,
  Preview reaches `AuditFlow` and SurveyJS renders (`sd-root-modern`) themed via the re-bridged
  `--sjs-*` vars (`--sjs-primary-backcolor` → `rgb(13,150,139)` teal). One more Cowork pass on a
  deliberately strict-invalid draft config is worthwhile (see re-QA list above).
