const DEFAULTS = {
  // Prefer environment overrides when available
  REACT: typeof process !== 'undefined' ? process.env?.REACT_APP_API_BASE : '',
  VITE: typeof process !== 'undefined' ? process.env?.VITE_API_BASE : '',
};

// PUBLIC_INTERFACE
export function getApiBase() {
  /**
   * Resolve backend API base URL.
   * - If REACT_APP_API_BASE or VITE_API_BASE is set, use it.
   * - Otherwise, default to same-origin '/api' when running behind proxy.
   * - If window.location.origin exists, return `${origin}/api`.
   */
  const envBase = DEFAULTS.REACT || DEFAULTS.VITE;
  if (envBase && typeof envBase === 'string') {
    try {
      // validate and normalize
      const u = new URL(envBase);
      return u.toString().replace(/\/+$/, '') + '/api';
    } catch {
      // if not absolute, return as-is
      return String(envBase).replace(/\/+$/, '') + '/api';
    }
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api`;
  }

  // Fallback to a sensible default in non-browser contexts
  return '/api';
}

export default { getApiBase };
