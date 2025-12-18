/**
 * Centralized API base URL used by API clients.
 * Resolution order:
 * 1) REACT_APP_API_BASE_URL (respected as the source of truth)
 * 2) window.location.origin + '/api'
 * 3) '/api'
 */
function resolveApiBase() {
  const fromEnv =
    (typeof process !== 'undefined' &&
      process.env &&
      process.env.REACT_APP_API_BASE_URL) ||
    '';
  if (fromEnv && String(fromEnv).trim()) {
    const trimmed = String(fromEnv).trim().replace(/\/*$/, '');
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
  }
  try {
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      return `${String(window.location.origin).replace(/\/*$/, '')}/api`;
    }
  } catch {
    // ignore
  }
  return '/api';
}

const apiBase = resolveApiBase();

/**
 * PUBLIC_INTERFACE
 * getApiBase
 * Returns the base URL for backend API requests.
 */
export function getApiBase() {
  return apiBase;
}

const config = {
  apiBase,
  getApiBase,
};

export default config;
export { apiBase };