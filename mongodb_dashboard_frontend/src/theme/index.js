import React from 'react';

/**
 * PUBLIC_INTERFACE
 * useTheme
 * Minimal hook for compatibility. Returns a static palette used across the app.
 * This prevents runtime/bundle errors after removing the custom theme provider.
 */
export function useTheme() {
  return {
    theme: {
      primary: '#2563EB',
      secondary: '#F59E0B',
      success: '#10B981',
      error: '#EF4444',
      text: '#111827',
      surface: '#ffffff',
      border: '#E5E7EB',
    }
  };
}

/**
 * PUBLIC_INTERFACE
 * setTheme
 * No-op to maintain compatibility where setTheme was previously called.
 */
export function setTheme() {
  // no-op: original app does not use dynamic theme switching
}

/**
 * PUBLIC_INTERFACE
 * ThemeProvider
 * Compatibility component that simply renders children without context.
 */
export function ThemeProvider({ children }) {
  return <>{children}</>;
}

// Backward compat named exports (no longer provided)
// getOceanTheme, getCategoricalPalette, getCategoryColorMap are intentionally removed.
