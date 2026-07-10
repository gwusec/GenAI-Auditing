// theme.js — the app's design system (UI rework step 1).
// Clean & minimal (Linear/Vercel family): Inter, an indigo accent on a neutral base,
// rounded corners, subtle borders instead of heavy shadows, no ALL-CAPS buttons.
// Light + dark palettes with a persisted mode toggle.

import React, { createContext, useContext, useMemo, useState } from 'react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

const ACCENT = { main: '#0d9488', light: '#2dd4bf', dark: '#0f766e', contrastText: '#ffffff' };

const softShadow = (isLight) =>
  isLight
    ? '0 1px 2px rgba(15,23,42,0.06), 0 1px 3px rgba(15,23,42,0.10)'
    : '0 1px 2px rgba(0,0,0,0.4), 0 1px 3px rgba(0,0,0,0.5)';

export function makeTheme(mode) {
  const isLight = mode !== 'dark';
  const divider = isLight ? '#e2e8f0' : '#1f2937';
  const paper = isLight ? '#ffffff' : '#111827';

  return createTheme({
    cssVariables: true,
    palette: {
      mode: isLight ? 'light' : 'dark',
      primary: ACCENT,
      background: {
        default: isLight ? '#f8fafc' : '#0b1120',
        paper,
      },
      text: isLight
        ? { primary: '#0f172a', secondary: '#475569' }
        : { primary: '#e5e7eb', secondary: '#94a3b8' },
      divider,
      // Grass-green success, deliberately distinct from the teal primary so
      // "Ready"/"complete" states don't blur into the accent color.
      success: { main: isLight ? '#16a34a' : '#22c55e' },
      warning: { main: isLight ? '#d97706' : '#f59e0b' },
      error: { main: isLight ? '#dc2626' : '#f87171' },
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      h1: { fontWeight: 700, fontSize: '2rem', letterSpacing: '-0.02em' },
      h2: { fontWeight: 700, fontSize: '1.5rem', letterSpacing: '-0.015em' },
      h3: { fontWeight: 600, fontSize: '1.25rem', letterSpacing: '-0.01em' },
      h5: { fontWeight: 600, letterSpacing: '-0.01em' },
      h6: { fontWeight: 600, letterSpacing: '-0.01em' },
      subtitle1: { fontWeight: 600 },
      button: { fontWeight: 600 },
      body1: { fontSize: '0.95rem' },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: { transition: 'background-color 220ms ease' },
          // Neutralize the browser's yellow/blue autofill background so saved
          // username/password fields (login/register) match the theme surface
          // instead of flashing an off-palette highlight.
          // `!important` is required to beat MUI's own higher-specificity input
          // autofill rule (an emotion class selector), which otherwise paints a
          // blue box-shadow over the field.
          'input:-webkit-autofill, input:-webkit-autofill:hover, input:-webkit-autofill:focus, input:-webkit-autofill:active': {
            WebkitBoxShadow: `0 0 0 100px ${paper} inset !important`,
            WebkitTextFillColor: `${isLight ? '#0f172a' : '#e5e7eb'} !important`,
            caretColor: isLight ? '#0f172a' : '#e5e7eb',
            borderRadius: 'inherit',
            transition: 'background-color 9999s ease-in-out 0s',
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            textTransform: 'none', borderRadius: 10, paddingLeft: 16, paddingRight: 16,
            transition: 'background-color 160ms ease, color 160ms ease, border-color 160ms ease, box-shadow 160ms ease',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none', transition: 'background-color 220ms ease, border-color 220ms ease' },
        },
      },
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: { border: `1px solid ${divider}`, borderRadius: 14, boxShadow: softShadow(isLight) },
        },
      },
      MuiAppBar: {
        defaultProps: { elevation: 0, color: 'default' },
        styleOverrides: {
          root: { backgroundImage: 'none', borderBottom: `1px solid ${divider}`, backgroundColor: paper },
        },
      },
      MuiTextField: { defaultProps: { size: 'small' } },
      MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 10 } } },
      MuiChip: { styleOverrides: { root: { borderRadius: 8, fontWeight: 500 } } },
      MuiDialog: { styleOverrides: { paper: { borderRadius: 16 } } },
      MuiTooltip: { styleOverrides: { tooltip: { borderRadius: 8, fontSize: 12 } } },
    },
  });
}

const ColorModeContext = createContext({ mode: 'light', toggle: () => {} });
export const useColorMode = () => useContext(ColorModeContext);

export function ThemeModeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    try { return localStorage.getItem('themeMode') || 'light'; } catch (_) { return 'light'; }
  });
  const ctx = useMemo(() => ({
    mode,
    toggle: () => setMode((m) => {
      const next = m === 'light' ? 'dark' : 'light';
      try { localStorage.setItem('themeMode', next); } catch (_) { /* noop */ }
      return next;
    }),
  }), [mode]);
  const theme = useMemo(() => makeTheme(mode), [mode]);

  return (
    <ColorModeContext.Provider value={ctx}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
