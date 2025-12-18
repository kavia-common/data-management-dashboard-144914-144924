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
  // PUBLIC_INTERFACE
  /**
   * Resolve the API base URL, ensuring it includes '/api' exactly once.
   * Resolution order:
   * 1) Respect REACT_APP_API_BASE_URL when provided (never override it with window.origin)
   * 2) Fallback to window.location.origin + '/api' (for local dev/proxy)
   * 3) Fallback to relative '/api'
   */
  const env = (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_BASE_URL) || '';

  if (env && typeof env === 'string' && env.trim()) {
    const trimmed = env.trim().replace(/\/*$/, '');
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
  // PUBLIC_INTERFACE
  /**
   * Join a base (which may or may not end with '/api') and a path (which may be absolute, start with '/api', or be relative),
   * guaranteeing that '/api' appears exactly once in the final URL.
   */
  const b = String(base || '').replace(/\/*$/, '');
  if (!path) {
    // eslint-disable-next-line no-console
    console.debug('[api/util] joinApiPath(base only)', b);
    return b;
  }

  const p = String(path);

  // Absolute URL -> return as-is
  if (/^https?:\/\//i.test(p)) {
    // eslint-disable-next-line no-console
    console.debug('[api/util] joinApiPath absolute passthrough', p);
    return p;
  }

  // If path begins with '/api', join against origin root part of base
  if (p.startsWith('/api')) {
    const originRoot = b.endsWith('/api') ? b.replace(/\/api$/, '') : b;
    const joined = `${originRoot}${p}`;
    // eslint-disable-next-line no-console
    console.debug('[api/util] joinApiPath path starts with /api ->', joined);
    return joined;
  }

  // Normal relative join under base
  const rel = p.startsWith('/') ? p : `/${p}`;
  const joined = `${b}${rel}`;
  // eslint-disable-next-line no-console
  console.debug('[api/util] joinApiPath joined', joined);
  return joined;
}
