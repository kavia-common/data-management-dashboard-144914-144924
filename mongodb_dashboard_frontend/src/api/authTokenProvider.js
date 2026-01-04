/*
 Centralized Auth and Organization token provider for client requests.
 Responsible for reading/writing the JWT and organization_id from storage,
 and exposing helpers for API clients to attach headers consistently.
*/

const AUTH_STORAGE_KEY = 'auth';
const ACTIVE_ORG_KEY = 'activeOrganization';
const ACTIVE_TENANT_KEY = 'activeTenant'; // legacy alias kept for backward compatibility
const ACTIVE_TENANT_NAME_KEY = 'activeTenantName'; // new: persist tenant display name from login

/**
 * Internal helper: read a raw token from a set of legacy storage keys.
 * This keeps backward compatibility with older parts of the app that used
 * keys like `auth_token` or `access_token`.
 */
function getLegacyToken() {
  try {
    const legacyKeys = [
      'auth_token',
      'token',
      'access_token',
      'session_token',
      'jwt',
    ];
    for (const k of legacyKeys) {
      const v = localStorage.getItem(k);
      if (v && String(v).trim()) return String(v).trim();
    }
  } catch {
    // ignore
  }
  return null;
}

// PUBLIC_INTERFACE
export function getToken() {
  /** Returns the stored JWT token or null if not logged in. */
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const token = parsed?.token || null;
      if (token) return token;
    }
  } catch {
    // fall through to legacy keys
  }

  // Backward compat: support older token storage keys.
  return getLegacyToken();
}

/**
 * PUBLIC_INTERFACE
 * getOrganizationId
 * Returns the active organization_id from localStorage.
 * Prefers ACTIVE_ORG_KEY; falls back to legacy ACTIVE_TENANT_KEY.
 */
export function getOrganizationId() {
  try {
    const oid = localStorage.getItem(ACTIVE_ORG_KEY);
    if (oid) return oid;
    const legacy = localStorage.getItem(ACTIVE_TENANT_KEY);
    return legacy || null;
  } catch {
    return null;
  }
}

// PUBLIC_INTERFACE
export function getTenantId() {
  /** Legacy helper: returns organization_id using previous name. */
  return getOrganizationId();
}

/**
 * PUBLIC_INTERFACE
 * setFromLoginResponse
 * Sets auth token and optionally organization_id from the login response.
 * - token is required for logged-in state
 * - organization_id, if present, will be mirrored into activeOrganization (and legacy activeTenant for compat)
 */
export function setFromLoginResponse({ token, organization_id, tenant_id, tenant_name } = {}) {
  try {
    const existing = (() => {
      try {
        const raw = localStorage.getItem(AUTH_STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
      } catch {
        return {};
      }
    })();
    const data = { ...existing, loggedIn: true };
    if (token) data.token = token;
    if (tenant_name) data.user = { ...(existing.user || {}), tenant_name };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore storage errors
  }

  const org = organization_id || tenant_id || null;
  try {
    if (org) {
      localStorage.setItem(ACTIVE_ORG_KEY, String(org));
      localStorage.setItem(ACTIVE_TENANT_KEY, String(org)); // legacy mirror
    }
    if (tenant_name) {
      localStorage.setItem(ACTIVE_TENANT_NAME_KEY, String(tenant_name));
    }
  } catch {
    // ignore
  }
}

/**
 * PUBLIC_INTERFACE
 * setActiveOrganizationId
 * Persist active organization id to localStorage and keep legacy key in sync.
 */
export function setActiveOrganizationId(organizationId) {
  try {
    if (organizationId) {
      localStorage.setItem(ACTIVE_ORG_KEY, String(organizationId));
      localStorage.setItem(ACTIVE_TENANT_KEY, String(organizationId)); // legacy mirror
    } else {
      localStorage.removeItem(ACTIVE_ORG_KEY);
      localStorage.removeItem(ACTIVE_TENANT_KEY);
    }
  } catch {
    // ignore
  }
}

// PUBLIC_INTERFACE
export function setActiveTenantId(tenantId) {
  /** Legacy alias mapping to organization setter. */
  return setActiveOrganizationId(tenantId);
}

// PUBLIC_INTERFACE
export function clearAuth() {
  /** Clears auth token and leaves tenant selection untouched by default. */
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * PUBLIC_INTERFACE
 * getTenantName
 * Returns the persisted tenant display name from login response if available.
 */
export function getTenantName() {
  try {
    // Prefer explicit key, then embedded in auth.user
    const name = localStorage.getItem(ACTIVE_TENANT_NAME_KEY);
    if (name && name.trim()) return name.trim();
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const fromUser = parsed?.user?.tenant_name || parsed?.tenant_name;
    return fromUser ? String(fromUser) : null;
  } catch {
    return null;
  }
}

/**
 * PUBLIC_INTERFACE
 * buildAuthHeaders
 * Builds headers with Authorization when available. Intentionally does NOT include any tenant header.
 * Tenant scoping must be provided via the tenant_id query parameter which is appended by the shared API clients.
 */
export function buildAuthHeaders(baseHeaders = {}) {
  const headers = { ...(baseHeaders || {}) };

  const token = getToken();
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  // Note: We no longer set 'X-Tenant-Id'. Tenant is appended as a query param elsewhere.

  return headers;
}
