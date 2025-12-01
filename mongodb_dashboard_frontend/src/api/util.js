export function buildQueryString(params = {}) {
  // PUBLIC_INTERFACE
  /** Builds query string beginning with '?' or returns empty string when no params. */
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== ""
  );
  if (entries.length === 0) return "";
  const usp = new URLSearchParams();
  for (const [k, v] of entries) {
    usp.append(k, String(v));
  }
  return `?${usp.toString()}`;
}

/**
 * PUBLIC_INTERFACE
 * getApiBaseUrl
 * Returns the API base URL string used by clients to prefix relative endpoints.
 * Priority:
 * - REACT_APP_API_BASE_URL env var if present (injected at build time)
 * - Otherwise, use relative '/api' (same-origin, works with CRA dev proxy)
 */
export function getApiBaseUrl() {
  const env = process.env.REACT_APP_API_BASE_URL;
  if (env && typeof env === "string" && env.trim()) {
    return env.replace(/\/+$/, "");
  }
  // Default to same-origin API prefix to leverage proxy and avoid cross-origin issues
  return "/api";
}