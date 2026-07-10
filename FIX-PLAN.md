# TRAILS — Audit Fix Plan & Handoff

**Written:** 2026-07-03, after a full code audit + live walkthrough of the Docker build, and one working session of fixes.
**Branch:** `audit-fixes` (checked out; see §1 before doing anything else).
**How to use this doc:** §1 is urgent repo state you must handle first. §2 is what was already fixed (uncommitted, in the working tree). §3 is the remaining work, in priority order, each item with files, concrete steps, and acceptance criteria. §4 is gotchas that will bite an implementer who skips them. §5 is the verification playbook.

The full audit report (MVP status table, every finding with file:line citations) and the live-QA findings are in the chat session that produced this file; the essentials are reproduced here so this doc stands alone.

---

## 1. ⚠️ Repo state — read before touching anything

1. **The last commit predates the Vite migration.** `git show HEAD:package.json` still says `react-scripts build`. The entire CRA→Vite migration (~68 files, +786/−6063) **plus all fixes below exist only as uncommitted working-tree changes** on `audit-fixes` (branched from `main-refactor`). If this working tree is lost, months of work go with it.
   