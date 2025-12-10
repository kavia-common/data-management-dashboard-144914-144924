import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useCurrentOrgId from './useCurrentOrgId';
import { fetchUsersSummary } from '../api/usersSummary';

/**
 * PUBLIC_INTERFACE
 * useUsersSignupTrend
 * Fetches users created summary for dashboard. Defaults to daily (today).
 * - Triggers initial fetch on mount (default range=daily)
 * - Refetches when range/start_date/end_date/org changes
 * - Ensures organization_id/tenant_id propagation
 * - Adds debug logging to verify /api/users/summary calls
 */
export default function useUsersSignupTrend(initial = {}) {
  const orgId = useCurrentOrgId();
  const initialRef = useRef(true);

  // Default params to daily and allow overrides from initial
  const [params, setParams] = useState(() => ({ range: 'daily', ...initial }));

  // Compute effective params including org fallback
  const effectiveParams = useMemo(() => {
    const p = { ...params };
    if (!p.organization_id && !p.tenant_id && orgId) p.organization_id = orgId;
    return p;
  }, [params, orgId]);

  const [state, setState] = useState({
    loading: false,
    data: { buckets: [] },
    error: null,
  });

  const reload = useCallback(async () => {
    const debugParams = { ...effectiveParams };
    try {
      setState((s) => ({ ...s, loading: true, error: null }));

      // Debug log to verify requests and tenant propagation
      // eslint-disable-next-line no-console
      console.log('[useUsersSignupTrend] fetching /api/users/summary', debugParams);

      const data = await fetchUsersSummary(effectiveParams);

      // eslint-disable-next-line no-console
      console.log('[useUsersSignupTrend] fetched', {
        buckets: data?.buckets?.length ?? 0,
        range: data?.range,
        start_date: data?.start_date,
        end_date: data?.end_date,
      });

      setState({ loading: false, data, error: null });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[useUsersSignupTrend] fetch error', err);
      setState({ loading: false, data: { buckets: [] }, error: err });
    }
  }, [effectiveParams]);

  // Trigger initial fetch on mount (range defaults to daily)
  useEffect(() => {
    if (initialRef.current) {
      initialRef.current = false;
      reload();
    }
  }, [reload]);

  // Refetch when dependencies change (range/date/org etc.)
  useEffect(() => {
    // Skip immediate re-run on first mount since above effect covers it
    if (!initialRef.current) {
      reload();
    }
  }, [effectiveParams.range, effectiveParams.start_date, effectiveParams.end_date, effectiveParams.organization_id, effectiveParams.tenant_id, reload]);

  return {
    ...state,
    params: effectiveParams,
    setParams,
    reload,
  };
}
