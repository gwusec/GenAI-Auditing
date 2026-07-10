# UI / Visual Rework (Scope)

> Implements the PRD's **UX-1…UX-5** (§5.8): a cohesive, modern design system across all
> screens, a smooth auditor flow, considered interaction states, polished core
> interactions, and a responsive layout — without regressing accessibility (§8.2, WCAG 2.1
> AA). Auditor surfaces are the priority (crowd-recruited, time-boxed). Also folds in the
> smaller UX items surfaced during live QA (`QA-findings.md`).

## 1. Why it looks dated (current state)

- **No theme.** No `createTheme` / `ThemeProvider` / `CssBaseline` — the app renders raw
  MUI defaults. Base font is **Arial** (`src/index.css`).
- **Hardcoded, inconsistent styling.** ~12 files use fixed pastel bubble colors
  (`#e0f7fa`, `#e8eaf6`), `elevation={3}` drop-shadows everywhere, and default **ALL-CAPS**
  buttons — the hallmarks of an un-themed, mid-2000s look.
- **No spacing/type rhythm.** Ad-hoc `sx` margins; default heavy type scale; cramped or
  uneven density.
- **CSS modules** (`*.module.css`) with bespoke colors per component, drifting from any
  system.

## 2. Strategy — theme first, then surface polish

The single highest-leverage change is a **custom MUI theme** applied globally. It restyles
every button, card, input, dialog, chip, and accordion at once. Then a focused pass
replaces the remaining hardcoded colors/shadows and tightens each key screen.

Order of impact: (1) theme + CssBaseline + font → (2) auditor surfaces → (3) investigator
surfaces → (4) smaller UX fixes → (5) responsive + a11y sweep.

## 3. The design system (concrete)

A modern, calm, professional aesthetic (Linear / Vercel / Stripe family): lots of
whitespace, one accent on a refined neutral base, soft rounded corners, subtle borders
over heavy shadows, no uppercase buttons.

- **Typography:** **Inter** (via `@fontsource/inter`, self-hosted — no external CDN),
  system-ui fallback. A deliberate scale (e.g. h1 32/600, h2 24/600, h6 16/600, body 15–16,
  caption 13), comfortable line-height (1.5), tracking tightened on large headings.
- **Color:** near-white app background (`#f8fafc`), white surfaces, near-black text
  (`#0f172a`, not pure black), a slate neutral ramp, and **one accent** (see decisions).
  Semantic success/warning/error kept but desaturated to match.
- **Shape:** `borderRadius: 12`; inputs/cards/buttons share it.
- **Elevation:** replace `elevation={3}` with **subtle borders + a soft shadow token**
  (e.g. `0 1px 2px rgba(15,23,42,.06), 0 1px 3px rgba(15,23,42,.1)`); reserve real shadows
  for dialogs/menus.
- **Spacing:** 8px base (MUI default), used consistently; roomier padding; max-width
  content columns.
- **Component defaults (theme overrides):**
  - `MuiButton`: `textTransform: none`, `disableElevation`, `borderRadius`, `fontWeight 600`,
    comfortable padding; refined contained/outlined/text variants.
  - `MuiCard`/`MuiPaper`: bordered, soft shadow, rounded; drop `elevation` reliance.
  - `MuiTextField`: one consistent variant, rounded, calm focus ring.
  - `MuiChip`, `MuiAccordion`, `MuiAppBar`, `MuiTabs/Stepper`, `MuiDialog`: themed to match.
- **Motion:** short, consistent transitions (150–200ms) on hover/press/expand; respect
  `prefers-reduced-motion`.

## 4. Surfaces (auditor-first)

1. **Auditor — chat** (`ChatMessages`, `ChatLayout`, sidebar, timer): modern message
   bubbles (themed tints, not `#e0f7fa`), a clean, legible timer/limit display, refined
   reaction controls, streaming/typing feedback, empty/error states.
2. **Auditor — audit** (`AuditFlow`, transcript, highlight step, `Questionnaire`): a calm
   two-pane, clear step header/progress, SurveyJS styled to the app (not bare Form Library
   defaults), a legible highlight interaction.
3. **Auditor — join / consent / complete** (`Feature0Gate`, `AuditorJoin`, completion):
   friendly, minimal, obvious primary action.
4. **Investigator — dashboard** (`StudyDashboard`): modern study cards, clear status,
   fix the clipped "Create & set up" button.
5. **Investigator — setup wizard** (`StudySetup`, `StudyConfigForm`, `QuestionnaireAuthor`):
   already restructured; apply the system, tighten spacing/hierarchy.

## 5. Fold-in UX fixes (from QA)

- **Tutorial:** condense the 8-step chat tutorial (+ the separate audit tutorial) to 1–2
  concise, dismissible steps — critical for time-boxed auditors.
- **Reactions on the audit transcript:** hide reaction controls outside the live chat.
- **Highlight boundary:** tighten the ~1-char selection offset in the highlighter.
- **PREVIEW needs two clicks:** fix the dashboard action.
- **Floating tooltip bubbles** ("Do not include personal information"…) — reposition/remove.
- Retire leftover **CSS-module hardcoded colors** in favor of theme tokens.

## 6. Accessibility (must not regress; §8.2)

- Theme colors meet **WCAG 2.1 AA** contrast (text ≥ 4.5:1, large ≥ 3:1); visible focus
  rings on every interactive element.
- Keyboard operability for chat, reactions, highlighting (the hardest — needs a
  non-mouse path), questionnaire; screen-reader labels + live-region announcement of new
  chat messages and step changes.
- Respect `prefers-reduced-motion`.

## 7. Work breakdown

1. **Theme + baseline:** add `@fontsource/inter`, `createTheme` (palette/type/shape/shadows
   + component overrides), wrap the app in `ThemeProvider` + `CssBaseline`; replace the
   Arial `index.css`. (Biggest visual jump; low risk.)
2. **Purge hardcoded styles:** replace the ~12 hardcoded colors/`elevation={3}` with theme
   tokens; convert bubble colors.
3. **Auditor surfaces** polish (chat → audit → join/complete).
4. **Investigator surfaces** polish (dashboard → wizard).
5. **UX fixes** (tutorial, reactions-in-audit, highlight boundary, PREVIEW, tooltips).
6. **Responsive + a11y sweep**; verify on laptop + a ~768px viewport; contrast/focus audit.

Each step ships behind the build + suite and is QA'd live in the browser.

## 8. Decisions (confirmed 2026-06-30)
1. **Aesthetic:** Clean & minimal (Linear / Vercel) — neutral base, one accent, subtle
   borders over shadows, whitespace.
2. **Accent:** Indigo / violet (`#4f46e5` / `#6366f1`).
3. **Typeface:** Inter (self-hosted via `@fontsource/inter`).
4. **Dark mode:** **Light + dark**, with a header toggle (persisted). Build both palettes
   from the theme step.

## 9. Progress
- **Step 1 — theme + baseline: built.** `src/theme.js` (`makeTheme(mode)` light+dark:
  indigo accent, Inter, `borderRadius 12`, subtle borders + soft shadow, no-caps buttons,
  themed Card/AppBar/Input/Chip/Dialog) + `ThemeModeProvider` (persisted mode) +
  `useColorMode`. Wired into `index.js` (`ThemeProvider` + `CssBaseline` + `@fontsource/inter`).
  Fixed `index.css` (removed Arial + hardcoded backgrounds so the theme drives font/bg).
  Dark-mode toggle in the investigator header. Build + suite (188) green. **Needs a fresh
  `npm install` — the Docker build handles it.** Pending live QA.
- **Step 1b — dark mode actually works + smoothness (2026-06-30).** Root cause of "dark
  mode isn't working": screens hardcoded `grey.50`/`primary.main` backgrounds and the CSS
  modules hardcoded `#f5f5f5`/`#e0f7fa`/`#3498db`. Fixes:
  - Removed the solid indigo AppBar/headers → **neutral** app bar + sticky bordered headers
    (`StudyDashboard`, `StudySetup`). Addresses "the blue with violet is terrible" — the
    accent is now used sparingly (buttons/links/chips), not as a full bar.
  - Replaced all hardcoded page backgrounds with `background.default` / `background.paper`
    across `StudyDashboard`, `StudySetup`, `Feature0Gate`.
  - **Enabled MUI `cssVariables: true`** so the `*.module.css` files can reference
    `var(--mui-palette-*)`. Converted the chat/transcript/summary modules
    (`ChatMessages`, `ChatBox`, `ConversationHistory`, `App`, `LoadingDots`) — bubbles,
    code blocks, loaders, sidebar now flip with the theme.
  - Chat message bubbles: theme-tinted (subtle indigo for the auditor, `background.paper`
    for the bot) instead of `#e0f7fa`/`#e8eaf6`; status chips use `color="success"/"warning"`.
  - `AuditFlow` transcript pane + `ChatBox` fairness panel: theme tints + `divider` borders,
    dropped `elevation={3}` drop-shadows for outlined surfaces.
  - Smoothness: `MuiCssBaseline` body + `MuiPaper`/`MuiButton` transitions (160–220ms) so the
    light↔dark switch and hovers ease instead of snapping.
  - Dark-mode toggle added to the auditor landing (`Feature0Gate`) in addition to the
    investigator header. Build + suite (188) green. Pending live Docker QA.
- Steps 2–6 remaining (auditor chat polish pass → investigator wizard polish → UX fixes
  [tutorial condense, reactions-in-audit, highlight boundary, tooltips] → responsive/a11y):
  pending.
