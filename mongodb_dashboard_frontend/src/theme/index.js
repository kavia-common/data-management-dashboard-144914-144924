import React, { createContext, useContext, useMemo } from 'react';
export { getOceanTheme, getCategoricalPalette, getCategoryColorMap } from './oceanTheme';

/**
 * PUBLIC_INTERFACE
 * setTheme
 * Apply theme mode tokens to document root. Currently supports 'dark' and default light.
 */
export function setTheme(mode = 'light') {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const isDark = String(mode).toLowerCase() === 'dark';

  // Base tokens - Ocean Professional
  root.style.setProperty('--color-primary', '#2563EB');
  root.style.setProperty('--color-secondary', '#F59E0B');
  root.style.setProperty('--color-success', '#10B981');
  root.style.setProperty('--color-error', '#EF4444');
  root.style.setProperty('--color-border', '#E5E7EB');

  if (isDark) {
    root.style.setProperty('--color-bg', '#0B1220');
    root.style.setProperty('--color-surface', '#0F172A');
    root.style.setProperty('--color-text', '#E5E7EB');
    root.style.setProperty('--color-text-secondary', '#9CA3AF');
  } else {
    root.style.setProperty('--color-bg', '#f9fafb');
    root.style.setProperty('--color-surface', '#ffffff');
    root.style.setProperty('--color-text', '#111827');
    root.style.setProperty('--color-text-secondary', '#6B7280');
  }

  // Card brown variant tokens used by UI/Card.css
  root.style.setProperty('--card-brown-bg', isDark ? '#0F172A' : '#ffffff');
  root.style.setProperty('--card-brown-bg-hover', isDark ? '#111827' : '#fdfdfd');
  root.style.setProperty('--card-brown-text', isDark ? '#E5E7EB' : '#111827');
  root.style.setProperty('--card-brown-text-hover', isDark ? '#FFFFFF' : '#111827');
  root.style.setProperty('--card-brown-border', isDark ? '#1F2937' : '#E5E7EB');
}

// PUBLIC_INTERFACE
export function getCurrentThemeMode() {
  /** Returns 'dark' or 'light' based on document tokens. */
  if (typeof document === 'undefined') return 'light';
  const text = getComputedStyle(document.documentElement).getPropertyValue('--color-text') || '';
  return text.trim() === '#E5E7EB' ? 'dark' : 'light';
}

// PUBLIC_INTERFACE
export function getCurrentTheme() {
  /**
   * Returns current theme token object with colors consistent with Ocean Professional.
   * Uses CSS variables if present, otherwise falls back to defaults.
   */
  const getVar = (name, fallback) => {
    if (typeof document === 'undefined') return fallback;
    const v = getComputedStyle(document.documentElement).getPropertyValue(name);
    const out = (v || '').trim();
    return out || fallback;
  };
  return {
    name: 'Ocean Professional',
    colors: {
      primary: getVar('--color-primary', '#2563EB'),
      secondary: getVar('--color-secondary', '#F59E0B'),
      success: getVar('--color-success', '#10B981'),
      error: getVar('--color-error', '#EF4444'),
      background: getVar('--color-bg', '#f9fafb'),
      surface: getVar('--color-surface', '#ffffff'),
      text: getVar('--color-text', '#111827'),
      muted: getVar('--color-text-secondary', '#6B7280'),
      border: getVar('--color-border', '#E5E7EB'),
    },
  };
}

// PUBLIC_INTERFACE
export const lightThemeTokens = {
  name: 'Ocean Professional Light',
  colors: {
    primary: '#2563EB',
    secondary: '#F59E0B',
    success: '#10B981',
    error: '#EF4444',
    background: '#f9fafb',
    surface: '#ffffff',
    text: '#111827',
    muted: '#6B7280',
    border: '#E5E7EB',
  },
};

// PUBLIC_INTERFACE
export const darkThemeTokens = {
  name: 'Ocean Professional Dark',
  colors: {
    primary: '#2563EB',
    secondary: '#F59E0B',
    success: '#10B981',
    error: '#EF4444',
    background: '#0B1220',
    surface: '#0F172A',
    text: '#E5E7EB',
    muted: '#9CA3AF',
    border: '#1F2937',
  },
};

// Lightweight theme context for components that call useTheme from '../../theme'
export const ThemeContext = createContext({ theme: lightThemeTokens });

// PUBLIC_INTERFACE
export function ThemeProvider({ children, value }) {
  /**
   * Provide theme to subtree; default to tokens based on current theme mode.
   * If value is provided, it should be an object like { colors: {...} }.
   */
  const mode = getCurrentThemeMode();
  const fallback = mode === 'dark' ? darkThemeTokens : lightThemeTokens;

  const derived = useMemo(() => {
    if (!value) return { theme: fallback.colors ? fallback : { colors: fallback.colors } };
    // normalize to { theme: { colors: ... } }
    if (value.colors) return { theme: value };
    return { theme: { colors: value } };
  }, [value, fallback]);

  return <ThemeContext.Provider value={derived}>{children}</ThemeContext.Provider>;
}

// PUBLIC_INTERFACE
export function useTheme() {
  /**
   * Returns { theme } with color tokens. Falls back to CSS variables when context not provided.
   */
  const ctx = useContext(ThemeContext);
  if (ctx && ctx.theme) return ctx;
  // Fallback: derive from CSS variables
  const current = getCurrentTheme();
  return { theme: current };
}
