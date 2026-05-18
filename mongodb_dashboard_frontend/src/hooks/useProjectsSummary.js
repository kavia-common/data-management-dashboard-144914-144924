import { useCallback, useEffect, useRef, useState } from 'react';
import { buildOverviewFilterParams } from '../api/buildOverviewFilterParams';
import { getOverviewProjectsSummary } from '../api/overviewAnalytics';

// PUBLIC_INTERFACE
export function useProjectsSummary({ organizationId, range, start_date, end_date, debounceMs = 150 }) {
  /** Hook to fetch projects summary with debouncing and single fetch path.
   * Params:
   *  - organizationId: string (tenant)
   *  - range: 'daily'|'weekly'|'monthly'|'custom'
   *  - start_date/end_date: required when range='custom'
   *  - debounceMs: number (default 150)
   * Returns: { status, error, buckets, refetch }
   */
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [buckets, setBuckets] = useState([]);

  const debounceRef = useRef(null);
  const mountedRef = useRef(false);

  const refetch = useCallback(async () => {
    if (!organizationId) return;
    setStatus('loading');
    setError(null);

    const params = { range };
    if (String(range).toLowerCase() === 'custom' && start_date && end_date) {
      params.start_date = start_date;
      params.end_date = end_date;
    }

    try {
      const req = buildOverviewFilterParams({ organizationId, params });
      const data = await getOverviewProjectsSummary(req);
      const list = Array.isArray(data?.buckets) ? data.buckets : [];
      if (list.length === 0) {
        setBuckets([]);
        setStatus('empty');
      } else {
        setBuckets(list);
        setStatus('success');
      }
    } catch (e) {
      setError(e?.message || 'Failed to load projects summary.');
      setStatus('error');
    }
  }, [organizationId, range, start_date, end_date]);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      refetch();
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      // For custom, ensure both bounds exist
      if (String(range).toLowerCase() === 'custom' && !(start_date && end_date)) return;
      refetch();
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [range, start_date, end_date, refetch, debounceMs]);

  return { status, error, buckets, refetch };
}

export default useProjectsSummary;
