import { useEffect, useMemo, useState } from 'react';
import { fetchUsersSummary } from '../api/usersSummary';
import useCurrentOrgId from './useCurrentOrgId';

// PUBLIC_INTERFACE
export default function useUsersSummary(params = {}) {
  /**
   * React hook to load users summary buckets from API.
   * It automatically fills organization_id from auth context if not provided.
   */
  const orgId = useCurrentOrgId();
  const [state, setState] = useState({ loading: true, data: null, error: null });

  const effectiveParams = useMemo(() => {
    const p = { range: 'daily', ...params };
    if (!p.organization_id && !p.tenant_id && orgId) {
      p.organization_id = orgId;
    }
    return p;
  }, [params, orgId]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setState(s => ({ ...s, loading: true, error: null }));
      try {
        const data = await fetchUsersSummary(effectiveParams);
        if (!cancelled) setState({ loading: false, data, error: null });
      } catch (err) {
        if (!cancelled) setState({ loading: false, data: null, error: err });
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [effectiveParams]);

  return state;
}
