import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { fetchProjectCreateSummary } from '../services/projectCreateSummaryApi';
import { projectCreateT0000Series } from '../utils/projectCreateT0000Series';
import { getOrgIdFromContext } from '../utils/orgContext';

/**
 * PUBLIC_INTERFACE
 * useProjectsCreatedSummary
 * Stable return shape and minimal diagnostics for Overview/Summary panels.
 * - Issues exactly one request per stable param set (guarded by refs)
 * - Always passes organization_id via query and x-organization-id header (api client)
 * - Uses AbortController that aborts only on unmount (no mid-flight cancels)
 * - Adapts T0000 array/object response to [{ name, value }]
 * - Prevents setState loops by shallow comparing before updating
 * - Adds debug markers to confirm effects run once per param change
 */
// PUBLIC_INTERFACE
export function useProjectsCreatedSummary(options = {}) {
  const [data, setData] = useState(null);
  const [t0000Series, setT0000Series] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Resolve organization_id from options or context; memoized for stability
  const organization_id = useMemo(
    () => (options.organization_id || getOrgIdFromContext() || '').trim(),
    [options.organization_id]
  );

  // Abort controller: create once; abort only on unmount
  const abortRef = useRef(null);
  useEffect(() => {
    abortRef.current = new AbortController();
    return () => {
      try {
        abortRef.current?.abort();
      } catch {
        // ignore
      }
    };
  }, []);

  // Memoize request params to avoid unnecessary re-renders/fetches
  const stableOptions = useMemo(() => {
    const { range, start_date, end_date, project_id } = options || {};
    return { range, start_date, end_date, project_id };
  }, [options.range, options.start_date, options.end_date, options.project_id]);

  const params = useMemo(
    () => ({ ...stableOptions, organization_id }),
    [stableOptions, organization_id]
  );

  // Stable helpers
  const shallowEqual = (a, b) => {
    if (a === b) return true;
    if (!a || !b) return false;
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    for (const k of aKeys) {
      if (a[k] !== b[k]) return false;
    }
    return true;
  };

  const arrayShallowEqual = (x = [], y = []) => {
    if (x === y) return true;
    if (!Array.isArray(x) || !Array.isArray(y)) return false;
    if (x.length !== y.length) return false;
    for (let i = 0; i < x.length; i += 1) {
      if (!shallowEqual(x[i], y[i])) return false;
    }
    return true;
  };

  // Track last applied states to prevent loops
  const lastDataRef = useRef(null);
  const lastSeriesRef = useRef([]);

  const inFlightRef = useRef(false);
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const performFetch = useCallback(async () => {
    if (!organization_id) {
      if (mountedRef.current) {
        setLoading(false);
        setError(null);
        if (lastDataRef.current !== null) setData(null);
        if (lastSeriesRef.current?.length) setT0000Series([]);
      }
      return;
    }

    if (inFlightRef.current) {
      if (process.env.NODE_ENV !== 'test') {
        // eslint-disable-next-line no-console
        console.debug('[useProjectsCreatedSummary] skip (in-flight)');
      }
      return;
    }

    inFlightRef.current = true;
    if (mountedRef.current) {
      setLoading(true);
      setError(null);
    }

    const isT0000 = String(organization_id).toUpperCase() === 'T0000';

    if (process.env.NODE_ENV !== 'test') {
      // eslint-disable-next-line no-console
      console.debug('[useProjectsCreatedSummary] fetch start', { organization_id, params });
    }

    try {
      const payload = await fetchProjectCreateSummary({
        ...params,
        organization_id,
        signal: abortRef.current?.signal,
      });

      if (!mountedRef.current) return;

      // Update data only if changed to avoid loops
      const nextData = payload || null;
      const shouldUpdateData =
        nextData === null
          ? lastDataRef.current !== null
          : !shallowEqual(
              { buckets: Array.isArray(nextData?.buckets) ? nextData.buckets.length : Array.isArray(nextData) ? nextData.length : 0 },
              { buckets: Array.isArray(lastDataRef.current?.buckets) ? lastDataRef.current.buckets.length : Array.isArray(lastDataRef.current) ? lastDataRef.current.length : 0 }
            );

      if (shouldUpdateData) {
        setData(nextData);
        lastDataRef.current = nextData;
      }

      // For T0000, adapt series and update only if changed
      let nextSeries = [];
      if (isT0000) {
        const src = Array.isArray(payload) ? payload : payload?.buckets || [];
        try {
          nextSeries = projectCreateT0000Series(src) || [];
        } catch (_) {
          nextSeries = [];
        }
      }

      if (!arrayShallowEqual(nextSeries, lastSeriesRef.current)) {
        setT0000Series(nextSeries);
        lastSeriesRef.current = nextSeries;
      }

      if (process.env.NODE_ENV !== 'test') {
        // eslint-disable-next-line no-console
        console.debug('[useProjectsCreatedSummary] fetch response', {
          isT0000,
          buckets: Array.isArray(payload?.buckets) ? payload.buckets.length : Array.isArray(payload) ? payload.length : 0,
          t0000SeriesLen: nextSeries.length,
        });
      }
    } catch (e) {
      if (!mountedRef.current) return;
      setError(e);
      if (process.env.NODE_ENV !== 'test') {
        // eslint-disable-next-line no-console
        console.debug('[useProjectsCreatedSummary] fetch error', { organization_id, message: String(e) });
      }
    } finally {
      if (mountedRef.current) setLoading(false);
      inFlightRef.current = false;
      if (process.env.NODE_ENV !== 'test') {
        // eslint-disable-next-line no-console
        console.debug('[useProjectsCreatedSummary] fetch end');
      }
    }
  }, [organization_id, params]);

  useEffect(() => {
    // trigger once per stable params change
    performFetch();
  }, [performFetch]);

  // Stable shape for consumers
  return { loading, error, data, t0000Series, organization_id };
}

export default useProjectsCreatedSummary;
