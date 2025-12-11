const DEFAULT_BASE = '/api';

/**
 * PUBLIC_INTERFACE
 * getApiBase
 * Return the API base path. Can be overridden by window.__API_BASE__ if defined.
 */
export function getApiBase() {
  if (typeof window !== 'undefined' && window.__API_BASE__) {
    return String(window.__API_BASE__);
  }
  return DEFAULT_BASE;
}
