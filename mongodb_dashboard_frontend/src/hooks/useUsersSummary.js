import { useEffect, useMemo, useState } from 'react';
import useCurrentOrgId from './useCurrentOrgId';

/**
 * PUBLIC_INTERFACE
 * useUsersSummary (placeholder)
 * This hook previously fetched /api/users/summary.
 * It now returns a stable placeholder shape without performing any network requests.
 */
export default function useUsersSummary(params = {}) {
  const orgId = useCurrentOrgId();

  // Normalize params, but no longer used for fetching
  const effectiveParams = useMemo(() => {
    const p = { range: 'daily', ...params };
    if (!p.organization_id && !p.tenant_id && orgId) {
      p.organization_id = orgId;
    }
    return p;
  }, [params, orgId]);

  const [state, setState] = useState({
    loading: false,
    data: { buckets: [] },
    error: null,
  });

  // Keep the same effect dependency to avoid behavioral changes, but do nothing
  useEffect(() => {
    // no-op: API disabled; ensure stable, empty data
    setState({ loading: false, data: { buckets: [] }, error: null });
  }, [effectiveParams]);

  return state;
}
