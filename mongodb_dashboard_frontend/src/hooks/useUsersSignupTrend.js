import { useCallback, useEffect, useMemo, useState } from 'react';
import useCurrentOrgId from './useCurrentOrgId';
import { fetchUsersSummary } from '../api/usersSummary';

/**
 * PUBLIC_INTERFACE
 * useUsersSignupTrend
 * Fetches users created summary for dashboard. Defaults to daily (today).
 */
export default function useUsersSignupTrend(initial = {}) {
  const orgId = useCurrentOrgId();
  const [params, setParams] = useState(() => ({ range: 'daily', ...initial }));
  const effectiveParams = useMemo(() => {
    const p = { ...params };
    if (!p.organization_id && !p.tenant_id && orgId) p.organization_id = orgId;
    return p;
  }, [params, orgId]);
  const [state, setState] = useState({ loading: false, data: { buckets: [] }, error: null });

  const reload = useCallback(async () => {
    try {
      setState(s => ({ ...s, loading: true, error: null }));
      const data = await fetchUsersSummary(effectiveParams);
      setState({ loading: false, data, error: null });
    } catch (err) {
      setState({ loading: false, data: { buckets: [] }, error: err });
    }
  }, [effectiveParams]);

  useEffect(() => { reload(); }, [reload]);

  return {
    ...state,
    params: effectiveParams,
    setParams,
    reload,
  };
}
