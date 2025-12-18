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
 * Backward-compatible resolver returning the API base URL string.
 */
export function getApiBaseUrl() {
  // Prefer current origin in preview/proxy environments
  try {
    if (typeof window !== "undefined" && window.location && window.location.origin) {
      return `${String(window.location.origin).replace(/\/*$/, "")}/api`;
    }
  } catch {
    // ignore and fallback to env
  }
  // Fallback to explicit env if provided
  const env = process.env.REACT_APP_API_BASE_URL;
  if (env && typeof env === "string" && env.trim()) {
    const trimmed = env.trim().replace(/\/*$/, "");
    return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
  }
  // Last resort: relative /api to allow dev proxy (setupProxy.js)
  return "/api";
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

/**
 * PUBLIC_INTERFACE
 * joinApiPath
 * Safely joins a base URL (which may end with '/api') with a path that may or may not start with '/api'.
 * Guarantees that '/api' appears exactly once in the returned URL.
 */
export function joinApiPath(base, path) {
  const b = String(base || "").replace(/\/*$/, "");
  if (!path) return b;
  const p = String(path);

  // Absolute URL -> return as-is
  if (/^https?:\/\//i.test(p)) return p;

  // If path begins with '/api', join against origin root part of base
  if (p.startsWith("/api")) {
    const originRoot = b.endsWith("/api") ? b.replace(/\/api$/, "") : b;
    return `${originRoot}${p}`;
  }

  // Normal relative join under base
  const rel = p.startsWith("/") ? p : `/${p}`;
  return `${b}${rel}`;
}
