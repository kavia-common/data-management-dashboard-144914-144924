import { useEffect, useMemo, useState } from 'react';
import useCurrentOrgId from './useCurrentOrgId';
import { fetchUsersSummary } from '../api/usersSummary';
import { format } from 'date-fns';

/**
 * PUBLIC_INTERFACE
 * useUsersSummary
 * Fetches users created summary buckets from /api/users/summary.
 * Params:
 *  - range: 'daily' | 'weekly' | 'monthly' | 'custom' (default 'daily').
 *  - start_date: 'YYYY-MM-DD' (required when range='custom')
 *  - end_date: 'YYYY-MM-DD' (required when range='custom')
 *  - organization_id / tenant_id: inferred from useCurrentOrgId when not provided
 *
 * Returns { loading, data: { buckets: [{ label, start?, end?, count }], range, start_date, end_date }, error }
 */
export default function useUsersSummary(params = {}) {
  const orgId = useCurrentOrgId();

  const effectiveParams = useMemo(() => {
    const defaults = { range: 'daily' };
    const merged = { ...defaults, ...params };

    // Prefer organization_id, fall back to tenant_id, infer from context when absent
    if (!merged.organization_id && !merged.tenant_id && orgId) {
      merged.organization_id = orgId;
    }

    // Normalize range value defensively
    const validRanges = new Set(['daily', 'weekly', 'monthly', 'custom']);
    if (!validRanges.has(merged.range)) {
      merged.range = 'daily';
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
    data: {
      buckets: [],
      range: effectiveParams.range,
      start_date: effectiveParams.start_date,
      end_date: effectiveParams.end_date,
    },
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));

    (async () => {
      try {
        const resp = await fetchUsersSummary(effectiveParams);

        // Validate and normalize response shape
        const safe = (resp && typeof resp === 'object') ? resp : {};
        const rawBuckets = Array.isArray(safe.buckets) ? safe.buckets : [];

        const buckets = rawBuckets.map((b, i) => {
          const label = typeof b.label === 'string' && b.label ? b.label : (typeof b.key === 'string' ? b.key : `Bucket ${i + 1}`);
          const countNum = Number(b.count);
          return {
            label,
            start: b.start ?? undefined,
            end: b.end ?? undefined,
            count: Number.isFinite(countNum) ? countNum : 0,
            key: typeof b.key === 'string' ? b.key : label,
          };
        });

        if (cancelled) return;
        setState({
          loading: false,
          data: {
            buckets,
            range: safe.range ?? effectiveParams.range,
            start_date: safe.start_date ?? effectiveParams.start_date,
            end_date: safe.end_date ?? effectiveParams.end_date,
          },
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.error('[useUsersSummary] fetch failed', { params: effectiveParams, err });
        setState({
          loading: false,
          data: {
            buckets: [],
            range: effectiveParams.range,
            start_date: effectiveParams.start_date,
            end_date: effectiveParams.end_date,
          },
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
