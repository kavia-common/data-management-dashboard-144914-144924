import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchProjectsSummary } from '../api/projectsSummary.client';
import { projectCreateT0000Series } from '../utils/projectCreateT0000Series';
import { getOrgIdFromContext } from '../utils/orgContext';

/**
 * PUBLIC_INTERFACE
 * useProjectsCreatedSummary
 * Hardened hook to fetch /api/projects/summary with:
 * - Single in-flight request guard
 * - Always passing organization_id in query and x-organization-id header
 * - AbortController that aborts only on unmount
 * - T0000 series transformation
 * - Minimal logs for start/end to detect cancellations
 */
// PUBLIC_INTERFACE
export function useProjectsCreatedSummary(options = {}) {
  const [data, setData] = useState(null);
  const [t0000Series, setT0000Series] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Resolve current org; options can override
  const organization_id = useMemo(
    () => (options.organization_id || getOrgIdFromContext() || '').trim(),
    [options.organization_id]
  );

  // Only abort on unmount
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

  // Avoid stringifying options; pick stable keys
  const stableOptions = useMemo(() => {
    const { range, start_date, end_date, project_id } = options || {};
    return { range, start_date, end_date, project_id };
  }, [options.range, options.start_date, options.end_date, options.project_id]);

  // Memoize params to enforce single in-flight on actual change
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
        console.log('[useProjectsCreatedSummary] fetch skipped (in-flight)');
      }
      return;
    }

    inFlightRef.current = true;
    setLoading(true);
    setError(null);

    let isActive = true;

    if (process.env.NODE_ENV !== 'test') {
      // eslint-disable-next-line no-console
      console.log('[useProjectsCreatedSummary] fetch start', params);
    }

    // Note: AbortController not passed to client; we only cancel on unmount by guarding isActive
    fetchProjectsSummary(params, organization_id)
      .then((payload) => {
        if (!isActive) return;
        setData(payload || null);
        if (organization_id === 'T0000' && Array.isArray(payload?.buckets) && payload.buckets.length > 0) {
          setT0000Series(projectCreateT0000Series(payload.buckets));
        } else {
          setT0000Series([]);
        }
      })
      .catch((e) => {
        if (!isActive) return;
        setError(e);
      })
      .finally(() => {
        if (!isActive) return;
        inFlightRef.current = false;
        setLoading(false);
        if (process.env.NODE_ENV !== 'test') {
          // eslint-disable-next-line no-console
          console.log('[useProjectsCreatedSummary] fetch end');
        }
      });

    return () => {
      isActive = false; // do not abort request; just ignore resolution after unmount/change
    };
  }, [params, organization_id]);

  return { data, t0000Series, loading, error, organization_id };
}

// Maintain default export for existing import styles
export default useProjectsCreatedSummary;
