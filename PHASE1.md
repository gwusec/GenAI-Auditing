# Phase 1 — Consolidate (Execution Log)

> Goal: resolve the two-implementation split and standardize the backend so new contributors meet one coherent system. Decision recorded: **canonical backend contract = `relay`** (self-contained `server/server.js`, keys server-side, matches the live Docker/Render deploy and the Phase 2 Supabase plan).
> Constraint (current): **do not push to GitHub.** All changes local.

## Findings (investigation)
- **`src/trails-chatbot/` is dead code** — nothing outside the folder imports it; the only `trails-chatbot` match in active code is the *event name string* `'trails-chatbot:audit-finished'`. Safe to delete.
- **Live beta runs the `relay` path:** the Docker image (`dockerfile`) ships `build/` + `server/server.js` and runs `node server.js`; the live `build/` bundle contains `relay`. The legacy `src/trails-chatbot/tools/APIClient.js` posts `{ messages, pid, relay }` to match it.
- **The refactor regressed the backend:** the new `src/tools/APIClient.js` posted only `{ messages, pid }` to an *external* proxy and dropped `relay` + the settings UI. This is the real "mismatch."
- **Orphaned scaffolding:** `src/components/adapters/*` + `ChatService.js` + the settings components (`LLMSelector`, `APIKeySetup`, `OllamaSetup`, `WebLLMSetup`, `BackendStatus`) exist but are not wired into the active `App`. Kept — they are the basis for the Phase 2 LLM seam and the Phase 4 settings UI.

## Done (code)
- [x] **Harvested the relay contract into `src/tools/APIClient.js`** — now posts `{ messages, pid, relay }`, sourcing `relay` from `config.llmRelay` (matches `server.js` and the proven legacy client). Throws a clear error if `config.llmRelay` is missing.
- [x] **`src/index.js`** — added a documented sample `llmRelay` config (Ollama default) so standalone dev works and the shape is self-documenting.
- [x] **Unit tests** — `src/tools/__tests__/APIClient.test.js` locks the relay payload, role mapping, and the 400 → `error400` path (axios mocked; no network).
- [x] **CI fix** — workflow uses `npm install` (lockfile is gitignored, so `npm ci` can't run yet).

## Done (docs)
- [x] **`README` Event API** — replaced the vague `audit-finished` detail with the real shape: an **array of conversation objects** (with a worked example pointer to `src/index.js`).
- [x] Data-flow / persistence section already corrected in Phase 0.

## Security baseline (1D)
- `server/server.js` hardening confirmed and treated as the baseline: CORS allowlist, per-IP chat rate limiting, request timeouts, SSRF protection on Ollama URLs (`isPrivateHost`), and secret redaction in logs.
- **`npm audit`: 58 findings (2 critical, 25 high, 18 moderate, 13 low).** Nearly all originate from `react-scripts`' dev/build toolchain (a known CRA issue), not production runtime. Recommendation: do not `audit fix --force` (risks breaking deps); address structurally in **Phase 1E** by migrating the build off CRA (Vite/tsup) which removes most of these transitive vulns. Track separately.

## Manual cleanups required (sandbox cannot delete files)
Run on your machine:
```bash
cd ~/Documents/GitHub/TRAILS-Website
rm -rf src/trails-chatbot          # confirmed dead code (nothing imports it)
rmdir scripts                      # empty stub
# (reader-dashboard/ is intentionally kept — it becomes the Phase 3 dashboard)
```
These are harmless until removed (not imported, not bundled).

## Recommended follow-ups (not blocking)
- Stop gitignoring `package-lock.json`; commit it; switch CI back to `npm ci`.
- Phase 4: wire the orphaned settings components into a real provider/config UI that writes `config.llmRelay`.
- Phase 1E: migrate build tooling off CRA (resolves most audit findings + enables the npm library build).

## Verification
- [x] Full unit suite green (see run below).
- [x] Production build compiles (to a clean BUILD_PATH; the in-repo `build/` EPERM is a sandbox-only quirk).
