import { useEffect, useMemo, useRef, useState } from 'react';
import { debounce as debounceFn } from '../utils/debounce';
import { get } from '../lib/httpClient';

/**
 * PUBLIC_INTERFACE
 * useUsersSummary(range, startDate, endDate, orgId)
 * A data-fetching hook for /api/users/summary with debounced requests and cancellation.
 * - range: 'daily' | 'weekly' | 'monthly' | 'custom'
 * - startDate, endDate: YYYY-MM-DD when range === 'custom'
 * - orgId: organization/tenant id
 *
 * Returns: { data, loading, error, refetch }
 */
export function useUsersSummary(range = 'daily', startDate = null, endDate = null, orgId = null) {
  const [data, setData] = useState(null); // { buckets: [], range, start_date, end_date }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Keep latest params stable for debounced fetch
  const paramsRef = useRef({ range, startDate, endDate, orgId });
  paramsRef.current = { range, startDate, endDate, orgId };

  // Abort controller to cancel in-flight requests when params change
  const abortRef = useRef(null);

  const doFetch = async () => {
    const { range: r, startDate: sd, endDate: ed, orgId: oid } = paramsRef.current;
    if (!oid) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    // Build query params
    const query = new URLSearchParams();
    query.set('organization_id', oid);
    if (r) query.set('range', r);
    if (r === 'custom') {
      if (sd) query.set('start_date', sd);
      if (ed) query.set('end_date', ed);
    }

    // Cancel any in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    setError(null);

    try {
      const response = await get(`/api/users/summary?${query.toString()}`, { signal: ac.signal });
      setData(response);
      setLoading(false);
      setError(null);
    } catch (err) {
      if (err?.name === 'AbortError') {
        // Ignore aborted requests
        return;
      }
      setError(err);
      setLoading(false);
    }
  };

  // Debounce to avoid rapid refetch on control changes
  const debouncedFetch = useMemo(() => debounceFn(doFetch, 300), []); // 300ms debounce

  useEffect(() => {
    debouncedFetch();
    // cleanup: cancel debounced timer and any in-flight request on unmount
    return () => {
      debouncedFetch.cancel?.();
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [range, startDate, endDate, orgId, debouncedFetch]);

  // PUBLIC_INTERFACE
  const refetch = () => doFetch();

  return { data, loading, error, refetch };
}
