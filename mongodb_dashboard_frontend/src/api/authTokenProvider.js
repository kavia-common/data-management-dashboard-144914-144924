/*
 Centralized Auth and Organization token provider for client requests.
 Responsible for reading/writing the JWT and organization_id from storage,
 and exposing helpers for API clients to attach headers consistently.
*/

const AUTH_STORAGE_KEY = 'auth';
const ACTIVE_ORG_KEY = 'activeOrganization';
const ACTIVE_TENANT_KEY = 'activeTenant'; // legacy alias kept for backward compatibility

/**
 * Attempt to retrieve an auth token from multiple sources in priority order:
 * 1) window.authTokenProvider?.getIdToken?.()
 * 2) localStorage: 'id_token' | 'auth_token' | JSON under AUTH_STORAGE_KEY { token }
 * 3) sessionStorage: same keys as localStorage
 */
export function getToken() {
  // window provider (e.g., Firebase/Custom)
  try {
    const maybeProvider = typeof window !== 'undefined' ? window.authTokenProvider : undefined;
    if (maybeProvider && typeof maybeProvider.getIdToken === 'function') {
      const token = maybeProvider.getIdToken();
      if (token && typeof token === 'string' && token.trim()) {
        return token;
      }
    }
  } catch {
    // ignore
  }

  // Helpers to read storage safely
  const readFromStorage = (storage) => {
    try {
      // Flat token keys
      const directKeys = ['id_token', 'auth_token'];
      for (const k of directKeys) {
        const v = storage.getItem(k);
        if (v && typeof v === 'string' && v.trim()) return v;
      }
      // JSON { token } under AUTH_STORAGE_KEY
      const raw = storage.getItem(AUTH_STORAGE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          const t = parsed?.token;
          if (t && typeof t === 'string' && t.trim()) return t;
        } catch {
          // not JSON, ignore
        }
      }
    } catch {
      // ignore
    }
    return null;
  };

  // localStorage first
  const lsToken = typeof localStorage !== 'undefined' ? readFromStorage(localStorage) : null;
  if (lsToken) return lsToken;

  // sessionStorage next
  const ssToken = typeof sessionStorage !== 'undefined' ? readFromStorage(sessionStorage) : null;
  if (ssToken) return ssToken;

  // Fallback to original JSON under AUTH_STORAGE_KEY if not yet caught
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const token = parsed?.token || null;
      if (token) return token;
    }
  } catch {
    // ignore
  }

  return null;
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
export function setFromLoginResponse({ token, organization_id, tenant_id } = {}) {
  try {
    if (token) {
      const data = { loggedIn: true, token };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data));
    } else {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ loggedIn: true }));
    }
  } catch {
    // ignore storage errors
  }

  const org = organization_id || tenant_id || null;
  if (org) {
    try {
      localStorage.setItem(ACTIVE_ORG_KEY, String(org));
      // keep legacy mirror for any scattered reads
      localStorage.setItem(ACTIVE_TENANT_KEY, String(org));
    } catch {
      // ignore
    }
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

  // Demo-mode fallback when no token present
  const allowDemo = String(process.env.REACT_APP_ALLOW_DEMO_AUTH || '').toLowerCase() === 'true';
  if (!token && allowDemo) {
    // Attach x-organization-id if available to help backend scoping without JWT
    const org = getOrganizationId();
    if (org && !headers['x-organization-id'] && !headers['X-Organization-Id']) {
      headers['x-organization-id'] = String(org);
    }
    // Optionally include a benign Authorization header for dev
    if (!headers.Authorization) {
      headers.Authorization = 'Bearer ok';
    }
  }

  return headers;
}
