export function buildQueryString(params = {}) {
  // PUBLIC_INTERFACE
  /**
   * Builds query string beginning with '?' or returns empty string when no params.
   * Note: preserves q unmodified; no trimming or removal occurs here.
   */
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
 * Backward-compatible resolver returning the API base URL string.
 */
export function getApiBaseUrl() {
  const env = process.env.REACT_APP_API_BASE_URL;
  if (env && typeof env === "string" && env.trim()) {
    return env.replace(/\/*$/, "");
  }
  try {
    const url = new URL(window.location.href);
    return `${url.protocol}//${url.hostname}:3001/api`;
  } catch {
    return "http://localhost:3001/api";
  }
}

/**
 * PUBLIC_INTERFACE
 * withTenantHeaders
 * Adds x-organization-id header when provided.
 */
export function withTenantHeaders(organizationId) {
  const headers = {};
  if (organizationId) headers['x-organization-id'] = String(organizationId);
  return headers;
}
