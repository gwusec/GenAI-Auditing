# Phase 0 — Stabilize (Execution Checklist)

> Goal: lock current behavior and set up guardrails **before** any refactor. No behavior changes in this phase.
> Constraint (current): **do not push to GitHub.** All changes stay local for review.

## A. Characterization tests (lock current behavior)
Capture what the code does *today*, quirks included — these become the safety net for later refactors.

- [ ] **`models.js`** — `Conversation` state machine (`chat → audit_likertresponse → audit_highlight → audit_textresponse → complete`), throw on advancing past `complete`, `ChatEvent` type/data validation, `getChat()` filtering, `addAudit`/`endAudit` behavior.
- [ ] **`ConversationHandler`** — `buildVisibleMessages` (edits mark originals as edited, restart inserts a `separator`) and `buildContext` (edits remove originals + their bot replies; context resets at last restart; `lastUserMessageIndex` tracking). Pure methods, no DB needed.
- [ ] **`ChatTimerSystem`** — start/pause/resume, `startNewChat`/`canStartNewChat`, phase vs overall timing, `stopPhaseTimer`, expiry events, `localStorage` persistence. Uses jest fake timers.
- [ ] *(later)* relay/adapter payload formatting per provider (`server.js` helpers) — defer until Track 1A picks the canonical contract.
- [ ] *(later)* full survey→chat→audit→complete integration test against `testing/mockServer.js`.

## B. CI scaffold
- [ ] GitHub Actions workflow: install → lint → `CI=true npm test` → `npm run build` on push/PR.
- [ ] Dependabot config (npm, weekly).
- [ ] (Local only for now — workflow file added but not pushed.)

## C. Documentation fixes (no behavior change)
- [ ] Fix README data-flow diagram: it claims **MongoDB**; reality is client-side **IndexedDB/Dexie** today (moving to **Supabase/Postgres**). Correct this.
- [ ] Add a short, accurate "how it actually works today" note (event-sourced conversations, local persistence, external proxy vs bundled relay).
- [ ] Flag (don't fix yet) the `pid` vs `relay` payload mismatch and the `src/trails-chatbot/` duplicate as known issues for Phase 1.

## D. Verification
- [ ] `CI=true npm test` green locally.
- [ ] `npm run build` succeeds.
- [ ] Tests pass against unmodified source (proves they characterize, not change, behavior).

---
### Progress log
- (updated as work proceeds)
