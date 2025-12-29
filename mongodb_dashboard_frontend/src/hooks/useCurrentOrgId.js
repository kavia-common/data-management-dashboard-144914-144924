import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * PUBLIC_INTERFACE
 * useCurrentOrgId()
 * Attempts to derive the active organization/tenant id from auth context, then query string.
 */
export default function useCurrentOrgId() {
  const auth = useAuth();

  // Prefer values from auth context
  const orgFromAuth =
    auth?.organizationId ||
    auth?.tenantId ||
    auth?.session?.organization_id ||
    auth?.session?.tenantId ||
    null;

  // Query string fallback (?organization_id or ?tenant_id)
  const search =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const qsOrg = search?.get('organization_id') || search?.get('tenant_id') || null;

  return useMemo(() => orgFromAuth || qsOrg || null, [orgFromAuth, qsOrg]);
}
