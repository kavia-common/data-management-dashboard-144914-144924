import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useCurrentOrgId from './useCurrentOrgId';
import { fetchUsersSummary } from '../api/usersSummary.client';

/**
 * PUBLIC_INTERFACE
 * useUsersSummary
 * Fetches users created summary from /api/users/summary and returns { data, loading, error, refetch }.
 *
 * Params (object):
 *  - organization_id (string, optional): tenant scope for summary. If omitted, falls back to current org (useCurrentOrgId).
 *  - tenant_id (string, optional): alias for organization_id (will be normalized).
 *  - range ('daily'|'weekly'|'monthly'|'custom', default 'daily'): bucket granularity.
 *  - start_date (YYYY-MM-DD): required when range='custom'.
 *  - end_date (YYYY-MM-DD): required when range='custom'.
 *  - enabled (boolean, default true): if false, fetching is disabled.
 *
 * Behavior:
 *  - Calls the backend on mount and whenever any input param changes.
 *  - Keeps '/api' relative path so preview proxy forwards to backend (port 3001).
 *  - Adds minimal console.debug logs in non-production to help verify calls.
 */
export default function useUsersSummary(params = {}) {
  const currentOrgId = useCurrentOrgId();

  const {
    organization_id,
    tenant_id,
    range = 'daily',
    start_date,
    end_date,
    enabled = true,
  } = params;

  const effectiveOrg = useMemo(
    () => organization_id || tenant_id || currentOrgId || '',
    [organization_id, tenant_id, currentOrgId]
  );

  const [data, setData] = useState(() => ({
    buckets: [],
    range: range || 'daily',
    start_date: start_date || null,
    end_date: end_date || null,
  }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const lastParamsRef = useRef('');

  const doFetch = useCallback(async () => {
    if (!enabled) return;
    const normalizedRange = String(range || 'daily').toLowerCase();
    if (normalizedRange === 'custom' && (!start_date || !end_date)) {
      // Wait for both dates before fetching custom range
      return;
    }

    const dedupeKey = JSON.stringify({
      organization_id: effectiveOrg,
      range: normalizedRange,
      start_date,
      end_date,
    });
    if (lastParamsRef.current === dedupeKey) return;
    lastParamsRef.current = dedupeKey;

    setLoading(true);
    setError(null);
    try {
      const payload = await fetchUsersSummary({
        organization_id: effectiveOrg || undefined,
        tenant_id: effectiveOrg || undefined,
        range: normalizedRange,
        start_date,
        end_date,
      });
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.debug('[useUsersSummary] fetched', {
          params: { organization_id: effectiveOrg, range: normalizedRange, start_date, end_date },
          payload,
        });
      }
      setData(
        payload || {
          buckets: [],
          range: normalizedRange,
          start_date: start_date || null,
          end_date: end_date || null,
        }
      );
    } catch (e) {
      setError(e);
      setData({
        buckets: [],
        range: normalizedRange,
        start_date: start_date || null,
        end_date: end_date || null,
      });
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn('[useUsersSummary] fetch error', e);
      }
    } finally {
      setLoading(false);
    }
  }, [effectiveOrg, range, start_date, end_date, enabled]);

  useEffect(() => {
    doFetch();
  }, [doFetch]);

  return { data, loading, error, refetch: doFetch };
}
