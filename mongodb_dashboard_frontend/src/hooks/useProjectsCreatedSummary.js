import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchProjectCreateSummary } from '../services/projectCreateSummaryApi';
import { projectCreateT0000Series } from '../utils/projectCreateT0000Series';
import { getOrgIdFromContext } from '../utils/orgContext';

/**
 * PUBLIC_INTERFACE
 * useProjectsCreatedSummary
 * Stable return shape and minimal diagnostics for Overview/Summary panels.
 * - Ensures only a single in-flight request (guarded by ref)
 * - Always passes organization_id via query and x-organization-id header (handled by api client)
 * - Uses AbortController that aborts only on unmount (no mid-flight cancels causing double-fetch)
 * - Adapts T0000 data to [{ name, value }] series for horizontal bar chart
 * - Keeps placeholder / empty-state for T0000 when data is empty
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

  // Abort controller: only abort on unmount
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

  // Guard to ensure a single in-flight request
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!organization_id) {
      setData(null);
      setT0000Series([]);
      setError(null);
      setLoading(false);
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
    setLoading(true);
    setError(null);

    let isActive = true;

    if (process.env.NODE_ENV !== 'test') {
      // eslint-disable-next-line no-console
      console.debug('[useProjectsCreatedSummary] request', {
        organization_id,
        params,
      });
    }

    fetchProjectCreateSummary({
      ...params,
      organization_id,
      signal: abortRef.current?.signal,
    })
      .then((payload) => {
        if (!isActive) return;
        setData(payload || null);

        const isT0000 = organization_id === 'T0000';
        // For T0000, adapt to horizontal bar chart series
        if (isT0000) {
          try {
            // Backend may return { buckets: [...] } or array for T0000 mode;
            // projectCreateT0000Series is defensive and accepts both.
            const src = Array.isArray(payload) ? payload : payload?.buckets || [];
            const series = projectCreateT0000Series(src);
            setT0000Series(Array.isArray(series) ? series : []);
          } catch (e) {
            setT0000Series([]);
            if (process.env.NODE_ENV !== 'test') {
              // eslint-disable-next-line no-console
              console.debug('[useProjectsCreatedSummary] series adapt error', String(e));
            }
          }
        } else {
          setT0000Series([]);
        }

        if (process.env.NODE_ENV !== 'test') {
          // eslint-disable-next-line no-console
          console.debug('[useProjectsCreatedSummary] response', {
            isT0000,
            buckets: Array.isArray(payload?.buckets) ? payload.buckets.length : (Array.isArray(payload) ? payload.length : 0),
            t0000SeriesLen: isT0000 ? (Array.isArray(t0000Series) ? t0000Series.length : 0) : 0,
          });
        }
      })
      .catch((e) => {
        if (!isActive) return;
        setError(e);
        if (process.env.NODE_ENV !== 'test') {
          // eslint-disable-next-line no-console
          console.debug('[useProjectsCreatedSummary] fetch error', {
            organization_id,
            message: String(e),
          });
        }
      })
      .finally(() => {
        if (!isActive) return;
        inFlightRef.current = false;
        setLoading(false);
        if (process.env.NODE_ENV !== 'test') {
          // eslint-disable-next-line no-console
          console.debug('[useProjectsCreatedSummary] fetch end');
        }
      });

    return () => {
      isActive = false;
    };
  }, [params, organization_id]);

  // Stable shape for consumers
  return { loading, error, data, t0000Series, organization_id };
}

export default useProjectsCreatedSummary;
