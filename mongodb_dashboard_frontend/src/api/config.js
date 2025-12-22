export function getApiBaseUrl() {
  const fromEnv =
    process.env.REACT_APP_BACKEND_URL ||
    process.env.REACT_APP_API_BASE_URL ||
    process.env.REACT_APP_API_BASE ||
    '';
  return fromEnv.replace(/\/+$/, '');
}

/**
 * PUBLIC_INTERFACE
 * getApiBase
 * Backwards-compatible export expected by existing clients.
 * Returns the base API URL; if callers expect '/api' suffix it should be included via env.
 */
export function getApiBase() {
  return getApiBaseUrl();
}
