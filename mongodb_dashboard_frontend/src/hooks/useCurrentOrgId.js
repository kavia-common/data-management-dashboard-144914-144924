import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * PUBLIC_INTERFACE
 * useCurrentOrgId
 * Returns the current effective organization/tenant id from the auth context.
 */
export default function useCurrentOrgId() {
  const { user } = useAuth?.() || {};
  return useMemo(
    () => user?.organization_id || user?.tenant_id || user?.orgId || user?.tenantId || null,
    [user]
  );
}
