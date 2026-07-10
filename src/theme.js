// theme.js — light/dark mode provider (ROADMAP Phase 1B, decision D1).
//
// The design system now lives in Tailwind + CSS custom properties (see
// src/index.css and tailwind.config.js); this module only owns the light/dark
// *mode*. It toggles the `dark` class on <html> (Tailwind's darkMode: 'class')
// and persists the choice, replacing the old MUI ThemeProvider/CssBaseline.
//
// Public API is unchanged so consumers don't need edits:
//   <ThemeModeProvider>   — wraps the app (src/index.js)
//   useColorMode()        — { mode: 'light' | 'dark', toggle() }

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

function applyMode(mode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (mode === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
  root.style.colorScheme = mode === 'dark' ? 'dark' : 'light';
}

const ColorModeContext = createContext({ mode: 'light', toggle: () => {} });
export const useColorMode = () => useContext(ColorModeContext);

export function ThemeModeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    try { return localStorage.getItem('themeMode') || 'light'; } catch (_) { return 'light'; }
  });

  // Reflect the mode onto <html> so Tailwind's `.dark` variant and the CSS
  // token overrides take effect for the whole document (portals included).
  useEffect(() => { applyMode(mode); }, [mode]);

  const ctx = useMemo(() => ({
    mode,
    toggle: () => setMode((m) => {
      const next = m === 'light' ? 'dark' : 'light';
      try { localStorage.setItem('themeMode', next); } catch (_) { /* noop */ }
      return next;
    }),
  }), [mode]);

  return (
    <ColorModeContext.Provider value={ctx}>
      {children}
    </ColorModeContext.Provider>
  );
}
