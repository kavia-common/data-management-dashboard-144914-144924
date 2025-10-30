 /**
  * PUBLIC_INTERFACE
  * buildQueryString
  * Converts a flat object into a query string starting with '?'.
  * Omits null/undefined/empty-string values.
  */
export function buildQueryString(params = {}) {
  /** This is a public function. */
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== ""
  );
  if (entries.length === 0) return "";
  const usp = new URLSearchParams();
  for (const [k, v] of entries) {
    usp.set(k, String(v));
  }
  return `?${usp.toString()}`;
}

/**
 * PUBLIC_INTERFACE
 * getApiBaseUrl
 * Returns the effective API base URL including the '/api' prefix.
 * Delegates to the same logic used by the axios client: prefers
 * REACT_APP_API_BASE_URL or window.__API_BASE_URL__ and appends '/api'.
 * If none are configured, returns '/api' to leverage relative proxying.
 */
export function getApiBaseUrl() {
  /** This is a public function. */
  const ENV_BASE = process.env.REACT_APP_API_BASE_URL || "";
  const RAW_BASE_URL = ENV_BASE || (typeof window !== "undefined" && window.__API_BASE_URL__) || "";

  // Helper to join base and path without duplicate slashes
  const joinUrl = (base, path) => {
    if (!base) return path || "";
    const b = String(base).endsWith("/") ? String(base).slice(0, -1) : String(base);
    const p = path ? (String(path).startsWith("/") ? path : `/${path}`) : "";
    return `${b}${p}`;
  };

  const API_PREFIX = "/api";
  const url = joinUrl(RAW_BASE_URL, API_PREFIX);

  // If RAW_BASE_URL is empty, use relative '/api'
  return url || API_PREFIX;
}
