export const AUTH_STORAGE_KEYS = {
  token: 'auth.token',
  tenantId: 'auth.tenantId',
  user: 'auth.user', // optional for future use
};

/**
 * Selects the best available storage (localStorage preferred, fallback to sessionStorage).
 */
function getBestStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch (e) {
    // ignore
  }
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage;
    }
  } catch (e) {
    // ignore
  }
  return null;
}

/**
 * Safely get from storage by key.
 */
function safeGet(key) {
  const storage = getBestStorage();
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Safely set to storage by key.
 */
function safeSet(key, value) {
  const storage = getBestStorage();
  if (!storage) return;
  try {
    storage.setItem(key, value);
  } catch {
    // ignore storage quota issues
  }
}

/**
 * Safely remove from storage by key.
 */
function safeRemove(key) {
  const storage = getBestStorage();
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // ignore
  }
}

// PUBLIC_INTERFACE
export function getAuthToken() {
  /** Returns the current JWT token from storage or null if not set. */
  return safeGet(AUTH_STORAGE_KEYS.token);
}

/**
 * PUBLIC_INTERFACE
 * setAuthToken
 * Persist the primary auth token. This should be the id_token when available.
 */
export function setAuthToken(token) {
  /** Sets the id_token (preferred) in storage. Pass null/undefined to clear. */
  if (!token) {
    safeRemove(AUTH_STORAGE_KEYS.token);
    return;
  }
  // Store as-is; callers must pass id_token. We intentionally do not map AccessToken here.
  safeSet(AUTH_STORAGE_KEYS.token, token);
}

// PUBLIC_INTERFACE
export function getTenantId() {
  /** Returns the current tenantId from storage or null if not set. */
  return safeGet(AUTH_STORAGE_KEYS.tenantId);
}

// PUBLIC_INTERFACE
export function setTenantId(tenantId) {
  /** Sets the tenantId in storage. Pass null/undefined to clear. */
  if (!tenantId) {
    safeRemove(AUTH_STORAGE_KEYS.tenantId);
    return;
  }
  safeSet(AUTH_STORAGE_KEYS.tenantId, tenantId);
}

// PUBLIC_INTERFACE
export function clearAuth() {
  /** Clears token and tenant info from storage. */
  safeRemove(AUTH_STORAGE_KEYS.token);
  safeRemove(AUTH_STORAGE_KEYS.tenantId);
  safeRemove(AUTH_STORAGE_KEYS.user);
}
