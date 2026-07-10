# Phase 4 (Architecture track) — CRA → Vite migration (Execution Log)

> Goal: replace Create React App (`react-scripts`) with **Vite** (dev + build) and
> **Vitest** (tests), without changing application behavior. This is the PRD's
> MVP architecture-track item — it clears most of the `npm audit` debt and unblocks
> the V1 library build (DEP-4) and the V1 UX polish.
> Verified in a clean install on a real filesystem (the mounted folder can't run
> `npm install` — its FUSE mount blocks the renames npm performs).

## What changed

### Added
- **`vite.config.js`** — React plugin; JSX-in-`.js` enabled (CRA allowed it) via both
  the React plugin `include` and an esbuild `loader: 'jsx'` scoped to `src/`; a
  `process.env` shim so `process.env.REACT_APP_*` keeps working in the browser
  (collected from shell **and** `.env` files, plus `NODE_ENV`), skipped under Vitest;
  `build.outDir: 'build'` to preserve the existing Docker / `server.js` static-serve;
  Vitest config (`jsdom`, `globals: true`).
- **`index.html`** at repo root — Vite's entry, loads `/src/index.js` as a module.

### Updated
- **`package.json`**
  - Scripts: `dev`/`start` → `vite`, `build` → `vite build`, `preview` → `vite preview`,
    `test` → `vitest run`, `test:watch` → `vitest`. Removed `eject`. `start-with-mock`
    now runs `vite`.
  - Removed the CRA `eslintConfig` (`react-app` preset shipped with react-scripts).
  - devDependencies: **removed** `react-scripts`, `@dotenvx/dotenvx`, and the two CRA
    `@babel/*-private-property-in-object` plugins; **added** `vite`,
    `@vitejs/plugin-react`, `vitest`, `jsdom`.
- **`.github/workflows/ci.yml`** — test step now `npm test` (Vitest); build step
  `npm run build` (Vite). Dropped the CRA-specific `CI=false` warnings-as-errors note
  and the react-scripts eslint pass.
- **Test suite (7 files)** — `jest.*` → `vi.*` throughout (Vitest globals). One special
  case: `src/tools/__tests__/APIClient.test.js` now uses `vi.hoisted()` for its axios
  mock fn, because `vi.mock` is hoisted above imports (Vitest's equivalent of Jest's
  `mock*`-prefix hoisting rule).

## Verification (clean install, real FS)
- `npm install` — 359 packages, no errors.
- `npm test` (Vitest) — **7 files / 60 tests passed.** No behavior change.
- `npm run build` (Vite) — succeeds; emits `build/index.html` + hashed `build/assets/*`
  and copies `public/*`. (One chunk-size warning from the MUI bundle — informational;
  code-splitting is a later optimization.)
- `npm audit` — **58 findings (2 critical, 25 high, 18 moderate, 13 low) under CRA →
  5 findings (1 critical, 1 high, 3 moderate) under Vite.** The remainder live in the
  Vitest/`vite-node` dev toolchain, not the production runtime.

## Manual follow-ups on the real checkout (sandbox can't delete/rename mounted files)
```bash
cd ~/Documents/GitHub/TRAILS-Website
npm install                 # deps changed: react-scripts/dotenvx out, vite/vitest in
rm -f config-overrides.js   # dead (react-app-rewired override; never wired — scripts used plain react-scripts)
rm -f .babelrc              # CRA/babel preset; Vite uses esbuild + @vitejs/plugin-react
rm -f public/index.html     # superseded by the root index.html (Vite's entry)
rm -rf build                # stale CRA output; `npm run build` regenerates it with Vite
# still pending from earlier:
rm -rf src/trails-chatbot && rmdir scripts
```
None of the above is imported or required by the Vite build; they are leftovers safe to
remove. Until removed they are harmless (Vite ignores them).

## Notes / not done here
- **npm library build (DEP-4, V1):** `package.json` `main`/`exports` still point at raw
  `src/lib.js`. Building an ESM+CJS+types bundle with `react`/`react-dom`/`@mui/*` as
  peerDependencies is the V1 follow-up; Vite library mode makes it straightforward now.
- **Lint:** the CRA eslint preset was removed; a standalone flat-config ESLint setup is a
  small, separate follow-up if a blocking lint gate is wanted in CI.
