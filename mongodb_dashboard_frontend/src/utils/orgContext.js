//
// Utility helpers to resolve current organization/tenant id for API calls.
// Provides a single source of truth used across org-aware features.
//

// PUBLIC_INTERFACE
export function getOrgIdFromAuthContext(auth) {
  /** Derive organization/tenant id from an auth context object.
   * Accepts typical shapes used in this app, returns string | undefined.
   */
  if (!auth) return undefined;
  // Try common fields seen across the app
  const direct =
    auth.organizationId ||
    auth.organisationId ||
    auth.tenantId ||
    auth.tenant_id ||
    auth.organization_id ||
    (auth.user && (auth.user.organizationId || auth.user.tenantId || auth.user.organization_id)) ||
    (auth.session && (auth.session.organizationId || auth.session.tenantId));
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  return undefined;
}

// PUBLIC_INTERFACE
export function getOrgIdFromStoredToken() {
  /** Extract organization/tenant id from a stored JWT payload if available.
   * Tries localStorage/sessionStorage keys commonly used in this project.
   * Returns string | undefined.
   */
  try {
    const tryKeys = ['auth_token', 'token', 'access_token', 'session_token', 'jwt'];
    let raw;
    for (const k of tryKeys) {
      raw = raw || (typeof window !== 'undefined' && (window.localStorage?.getItem(k) || window.sessionStorage?.getItem(k)));
    }
    if (!raw) return undefined;

    const token = raw.replace(/^Bearer\s+/i, '').trim();
    const parts = token.split('.');
    if (parts.length < 2) return undefined;

    const payloadJson = JSON.parse(atob(parts[1]));
    const fields = ['organizationId', 'organization_id', 'tenantId', 'tenant_id', 'org', 'tenant'];
    for (const f of fields) {
      if (typeof payloadJson[f] === 'string' && payloadJson[f].trim()) {
        return payloadJson[f].trim();
      }
    }
  } catch (_) {
    // ignore
  }
  return undefined;
}

// PUBLIC_INTERFACE
export function getOrgIdFromContext() {
  /**
   * Returns the effective organization id used across the app.
   * Priority:
   * 1) window.__ORG_ID__ (set by bootstrap/session)
   * 2) Cookie "organization_id"
   * 3) LocalStorage "x-organization-id"
   * 4) JWT payload from stored tokens
   */
  try {
    const fromWindow = typeof window !== 'undefined' ? window.__ORG_ID__ : null;
    if (fromWindow) return String(fromWindow);

    if (typeof document !== 'undefined') {
      const cookie = document.cookie || '';
      const match = cookie.match(/(?:^|;\s*)organization_id=([^;]+)/);
      if (match && match[1]) return decodeURIComponent(match[1]);
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      const headerOverride = window.localStorage.getItem('x-organization-id');
      if (headerOverride) return headerOverride;
    }

    const fromToken = getOrgIdFromStoredToken();
    if (fromToken) return fromToken;

    return null;
  } catch {
    return null;
  }
}

// PUBLIC_INTERFACE
export function resolveOrganizationId({ auth } = {}) {
  /** Resolve the current organization/tenant id using various strategies.
   * - Prefer AuthContext if provided
   * - Fallback to getOrgIdFromContext (cookie/header/localStorage/JWT)
   */
  const fromCtx = getOrgIdFromAuthContext(auth);
  if (fromCtx) return fromCtx;
  return getOrgIdFromContext();
}
