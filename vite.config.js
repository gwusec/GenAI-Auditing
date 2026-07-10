/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Migrated from Create React App (react-scripts) to Vite.
//
// Two CRA behaviors are preserved deliberately:
//   1. `process.env.REACT_APP_*` keeps working in the browser (see the `define`
//      shim below) so application source did not have to change.
//   2. The production bundle is emitted to `build/` so the existing Docker image
//      and `server/server.js` static-serving continue to work unchanged.
export default defineConfig(({ mode }) => {
  const isTest = mode === 'test' || !!process.env.VITEST;

  // Collect REACT_APP_* from .env files AND the shell environment, so that both
  //   REACT_APP_FEATURE0=on npm run dev        (shell var)
  //   REACT_APP_FEATURE0=on   in a .env file   (dotenv file)
  // behave exactly as they did under CRA.
  const fileEnv = loadEnv(mode, process.cwd(), '');
  const reactAppEnv = {};
  for (const [key, value] of Object.entries({ ...fileEnv, ...process.env })) {
    if (key.startsWith('REACT_APP_')) reactAppEnv[key] = value;
  }
  const shimmedProcessEnv = {
    ...reactAppEnv,
    NODE_ENV: mode === 'production' ? 'production' : 'development',
  };

  return {
    // include: also transform JSX that lives in `.js` files (CRA allowed this).
    plugins: [react({ include: /\.(jsx?|tsx?)$/ })],

    // CRA allowed JSX inside `.js` files. Vite's internal esbuild passes (e.g.
    // `vite:define`) default `.js` to plain JS and would error on that JSX, so
    // tell esbuild to parse `src/**/*.js` as JSX. Scoped to src to avoid forcing
    // the JSX loader onto plain-JS dependencies in node_modules.
    esbuild: {
      loader: 'jsx',
      include: /src\/.*\.jsx?$/,
      exclude: [],
    },
    optimizeDeps: {
      esbuildOptions: { loader: { '.js': 'jsx' } },
    },

    // Replace `process.env` in browser code with a static object containing the
    // app's REACT_APP_* vars + NODE_ENV. Any unset REACT_APP_* read resolves to
    // `undefined` (not a crash), matching CRA. Skipped under Vitest, which runs
    // in Node with a real process.env.
    define: isTest ? {} : { 'process.env': JSON.stringify(shimmedProcessEnv) },

    // Also expose REACT_APP_* on import.meta.env for any future code that prefers it.
    envPrefix: 'REACT_APP_',

    server: { port: 3000 },
    preview: { port: 3000 },

    // Keep CRA's output directory so deployment (Docker + server.js) is unaffected.
    build: { outDir: 'build' },

    test: {
      globals: true,
      environment: 'jsdom',
      include: ['src/**/*.{test,spec}.{js,jsx}', 'server/**/*.{test,spec}.{js,jsx}'],
    },
  };
});
