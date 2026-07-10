# Phase 3 — Feature 0: Accounts, Roles & Studies (Execution Log)

> Goal: the backbone — investigators create studies and assign per-study roles;
> auditors join (anonymously) via access codes; data access is role-scoped.
> Approach (your choice): **build now with a mock backend** behind the same seam
> pattern, so it's testable today and Supabase-ready later.
> Constraint (current): **do not push to GitHub.** All changes local. **Behavior
> of the existing app is unchanged** — Feature 0 is opt-in via a flag.

## Auth seam (`src/tools/auth/`)
- `AuthProvider.js` — interface: signUp / signIn / signInAnonymously / linkEmail
  (anon→account upgrade) / signOut / getCurrentUser / onAuthChange.
- `MockAuthProvider.js` — in-memory (optional localStorage). Encodes real
  semantics incl. **anonymous→account upgrade that preserves the user id** (so
  data created while anonymous stays attached — mirrors Supabase linking).
- `SupabaseAuthProvider.js` — skeleton mapping to `supabase.auth.*`; throws until
  configured.
- `index.js` — factory; defaults to mock, `REACT_APP_AUTH=supabase` to switch.

## Studies seam (`src/tools/studies/`)
- `StudyService.js` — interface: createStudy / getStudy / listStudiesForUser /
  updateStudy / addMember / listMembers / getUserRoles / createAccessCode /
  redeemAccessCode.
- `MockStudyService.js` — enforces **per-study roles** and **RLS-equivalent
  scoping** in app code (non-members can't read; only investigators can update or
  list members), plus access-code limits (expiry, max-uses) and anonymous
  redemption → auditor membership.
- `SupabaseStudyService.js` — skeleton mapping to the `studies` /
  `study_members` / `access_codes` tables; throws until configured.
- `index.js` — factory; defaults to mock, `REACT_APP_STUDIES=supabase` to switch.

## UI (`src/feature0/`)
- `Feature0Context.jsx` — React context exposing the services + current
  user/study; `joinWithCode()` does anonymous sign-in + redeem in one step.
- `InvestigatorAuth.jsx` — login / sign-up.
- `AuditorJoin.jsx` — anonymous join by access code.
- `StudyDashboard.jsx` — investigator home: list/create studies, generate access
  codes (seed of the Phase 3 results dashboard that will fill `reader-dashboard/`).
- `Feature0Gate.jsx` — landing: investigator vs "I have a code".
- `Feature0Shell.jsx` — ties it together: auditor-in-study → existing audit
  `<App>` (scoped via `config.studyId`); investigator → dashboard; else → gate.

## Integration (opt-in, behavior-preserving)
- `src/index.js` — extracted shared `appProps`; renders `<Feature0Shell>` only
  when `REACT_APP_FEATURE0` ∈ {on,1,true}; otherwise renders the plain `<App>`
  exactly as before. **Default = off = unchanged behavior.**

## Tests
- `src/tools/__tests__/feature0.test.js` (12) — auth (accounts, anonymous,
  upgrade-preserves-id, auth-change events) and studies (owner→investigator,
  scoping, investigator-only mutations, code redemption, expiry/limit, dual-role
  across studies).
- `src/feature0/__tests__/feature0-ui.smoke.test.js` — UI import/transpile smoke.
- **Full suite: 60 tests / 7 suites green.**

## What's deferred (needs live Supabase or later phases)
- Real auth/persistence: flip `REACT_APP_AUTH=supabase`, `REACT_APP_STUDIES=supabase`,
  `REACT_APP_PERSISTENCE=supabase`, finish the skeleton method bodies, add the
  anonymous-code-redemption RPC.
- **Study-scoped conversation persistence:** the audit `<App>` receives
  `config.studyId`, but the local IndexedDB store doesn't yet tag conversations
  by study — that lands when the Supabase store is activated.
- Investigator **results dashboard** (aggregates, live observability) — builds on
  this once data flows to Supabase.

## Manual cleanups still pending (sandbox can't delete)
```bash
cd ~/Documents/GitHub/TRAILS-Website
rm -rf src/trails-chatbot && rmdir scripts
```

## Try it locally
```bash
REACT_APP_FEATURE0=on npm start
# Investigator: create account -> create study -> "Generate code"
# Auditor (new tab/incognito): "I have a code" -> paste code -> runs the audit app
```

## Verification
- [x] 60/60 tests green.
- [x] Feature 0 UI import-smoke passes (MUI + context + seams resolve).
- [x] Default behavior unchanged (flag off).
