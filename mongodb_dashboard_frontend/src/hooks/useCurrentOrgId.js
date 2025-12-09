import { useContext, useMemo } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import { OrgContext } from '../utils/orgContext';

/**
 * PUBLIC_INTERFACE
 * useCurrentOrgId()
 * Attempts to derive the active organization/tenant id from available contexts.
 * Falls back to query string (?organization_id or ?tenant_id) if necessary.
 * This is a lightweight stub to be replaced by the project's auth/tenant selection logic.
 */
export default function useCurrentOrgId() {
  // Try AuthContext if it provides tenant info
  const auth = useContext(AuthContext);
  const orgFromAuth =
    auth?.activeTenantId ||
    auth?.tenantId ||
    auth?.organizationId ||
    auth?.session?.tenantId ||
    auth?.session?.organization_id ||
    null;

  // Try OrgContext (utility context used in project)
  const orgCtx = useContext(OrgContext);
  const orgFromOrgCtx =
    orgCtx?.organizationId || orgCtx?.tenantId || orgCtx?.activeTenantId || null;

  // Query string fallback
  const search = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const qsOrg = search?.get('organization_id') || search?.get('tenant_id') || null;

  return useMemo(() => orgFromAuth || orgFromOrgCtx || qsOrg || null, [orgFromAuth, orgFromOrgCtx, qsOrg]);
}
