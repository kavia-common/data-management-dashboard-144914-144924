//
// PUBLIC_INTERFACE
// resolveTenantId
// Provides a consistent way to resolve tenant_id on the frontend.
//
// Resolution order (first non-empty wins):
// 1) Explicit arg (passedTenantId)
// 2) AuthContext (organizationId/tenantId) via optional getter
// 3) Local storage keys: 'activeTenant', 'activeOrganization', 'organization_id', 'tenant_id' (legacy fallbacks)
// 4) Environment variable REACT_APP_TENANT_ID (for local/dev demos ONLY)
// 5) Null if nothing is available
//
// Debugging: enable by setting localStorage.debug_tenant='1'
export function resolveTenantId(passedTenantId, authGetter) {
  const DEBUG = typeof window !== 'undefined' && window.localStorage && window.localStorage.getItem('debug_tenant') === '1';

  const tryGet = (label, fn) => {
    try {
      const v = fn();
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.debug(`[tenantSelection] ${label}=`, v);
      }
      return v;
    } catch {
      return undefined;
    }
  };

  // 1) Explicit
  if (passedTenantId && String(passedTenantId).trim().length > 0) {
    if (DEBUG) console.debug('[tenantSelection] using explicit arg');
    return String(passedTenantId);
  }

  // 2) From AuthContext via getter (deferred to avoid circular imports)
  if (typeof authGetter === 'function') {
    const fromAuth = tryGet('authGetter()', () => authGetter());
    if (fromAuth) return String(fromAuth);
  }

  // 3) Local storage variants
  const lsKeys = ['activeTenant', 'activeOrganization', 'organization_id', 'tenant_id', 'activeTenantId'];
  for (const key of lsKeys) {
    const val = tryGet(`localStorage.${key}`, () => window.localStorage.getItem(key));
    if (val) return String(val);
  }

  // 4) Environment fallback (demo/dev)
  const envVal = tryGet('REACT_APP_TENANT_ID', () => process.env.REACT_APP_TENANT_ID);
  if (envVal) return String(envVal);

  // 5) No tenant
  return null;
}
