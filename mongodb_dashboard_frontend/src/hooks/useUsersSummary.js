import { useEffect, useMemo, useState } from 'react';
import useCurrentOrgId from './useCurrentOrgId';
import { fetchUsersSummary } from '../api/usersSummary';
import { format } from 'date-fns';

/**
 * PUBLIC_INTERFACE
 * useUsersSummary
 * Fetches users created summary buckets from /api/users/summary.
 * Params:
 *  - range: 'daily' | 'weekly' | 'monthly' | 'custom' (default 'daily')
 *  - start_date: 'YYYY-MM-DD' (required when range='custom')
 *  - end_date: 'YYYY-MM-DD' (required when range='custom')
 *  - organization_id / tenant_id: will be inferred from auth/query via useCurrentOrgId when not provided
 */
export default function useUsersSummary(params = {}) {
  const orgId = useCurrentOrgId();

  const effectiveParams = useMemo(() => {
    const defaults = { range: 'daily' };
    const merged = { ...defaults, ...params };
    if (!merged.organization_id && !merged.tenant_id && orgId) {
      merged.organization_id = orgId;
    }
    // For non-custom ranges, ensure we don't pass stray dates
    if (merged.range !== 'custom') {
      delete merged.start_date;
      delete merged.end_date;
    } else {
      // If custom has no dates, default to last 30 days
      if (!merged.start_date || !merged.end_date) {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 29);
        merged.start_date = format(start, 'yyyy-MM-dd');
        merged.end_date = format(end, 'yyyy-MM-dd');
      }
    }
    return merged;
  }, [params, orgId]);

  const [state, setState] = useState({
    loading: true,
    data: { buckets: [], range: effectiveParams.range, start_date: effectiveParams.start_date, end_date: effectiveParams.end_date },
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));

    (async () => {
      try {
        const data = await fetchUsersSummary(effectiveParams);
        if (cancelled) return;
        setState({
          loading: false,
          data: data || { buckets: [], range: effectiveParams.range, start_date: effectiveParams.start_date, end_date: effectiveParams.end_date },
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        setState({
          loading: false,
          data: { buckets: [], range: effectiveParams.range, start_date: effectiveParams.start_date, end_date: effectiveParams.end_date },
          error: err,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [effectiveParams]);

  return state;
}
