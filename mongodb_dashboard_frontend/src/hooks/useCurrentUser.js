import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { getTenantName } from '../api/authTokenProvider';

/**
 * PUBLIC_INTERFACE
 * useCurrentUser
 * Returns a stable user object derived from AuthContext and persisted auth storage.
 * Exposes { tenant_name } as first-class field for UI usage.
 */
export default function useCurrentUser() {
  const auth = useAuth?.() || {};
  const ctxTenantName = auth?.user?.tenant_name || null;
  const persistedTenantName = getTenantName();

  return useMemo(() => {
    const tenant_name = ctxTenantName || persistedTenantName || null;
    return { tenant_name };
  }, [ctxTenantName, persistedTenantName]);
}
