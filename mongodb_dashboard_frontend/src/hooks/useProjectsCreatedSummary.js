import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchProjectsSummary } from '../api/projectsSummary.client';
import { projectCreateT0000Series } from '../utils/projectCreateT0000Series';
import { getOrgIdFromContext } from '../utils/orgContext';

/**
 * PUBLIC_INTERFACE
 * useProjectsCreatedSummary
 * Stable return shape and minimal diagnostics for Overview/Summary panels.
 */
// PUBLIC_INTERFACE
export function useProjectsCreatedSummary(options = {}) {
  const [data, setData] = useState(null);
  const [t0000Series, setT0000Series] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const organization_id = useMemo(
    () => (options.organization_id || getOrgIdFromContext() || '').trim(),
    [options.organization_id]
  );

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

  const stableOptions = useMemo(() => {
    const { range, start_date, end_date, project_id } = options || {};
    return { range, start_date, end_date, project_id };
  }, [options.range, options.start_date, options.end_date, options.project_id]);

  const params = useMemo(
    () => ({ ...stableOptions, organization_id }),
    [stableOptions, organization_id]
  );

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
      console.debug('[useProjectsCreatedSummary] fetch start', {
        organization_id,
        params,
      });
    }

    fetchProjectsSummary(params, organization_id)
      .then((payload) => {
        if (!isActive) return;
        setData(payload || null);

        const bucketsLen = Array.isArray(payload?.buckets) ? payload.buckets.length : 0;
        const isT0000 = organization_id === 'T0000';

        if (isT0000 && bucketsLen > 0) {
          try {
            setT0000Series(projectCreateT0000Series(payload.buckets));
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
          console.debug('[useProjectsCreatedSummary] fetch ok', {
            buckets: bucketsLen,
            isT0000,
            t0000SeriesLen: isT0000 ? (Array.isArray(payload?.buckets) ? payload.buckets.length : 0) : 0,
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
