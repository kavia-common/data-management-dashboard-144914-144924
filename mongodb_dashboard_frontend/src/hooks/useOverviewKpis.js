import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import useCurrentOrgId from './useCurrentOrgId';
import { fetchOverviewTotals, adaptOverviewTotalsToKpis } from '../api/overviewMetrics.client';

/**
 * PUBLIC_INTERFACE
 * useOverviewKpis
 * Loads KPI tiles for the Overview page on mount. Ensures a single in-flight request,
 * passes organization_id via query and x-organization-id header, logs debug info,
 * tolerates empty/variant payloads, and aborts only on unmount.
 *
 * @returns {{ kpis: Array<{label:string,value:number,delta?:number}>, loading: boolean, error: string|null, reload: () => void }}
 */
export function useOverviewKpis() {
  const organizationId = useCurrentOrgId(); // returns current tenant or 'T0000' etc.
  const [kpis, setKpis] = useState(() => []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const abortRef = useRef(null);
  const inflightRef = useRef(false);
  const paramsKeyRef = useRef(null);
  const mountedRef = useRef(false);
  const lastKpisRef = useRef([]);

  useEffect(() => {
    mountedRef.current = true;
    abortRef.current = new AbortController();
    return () => {
      mountedRef.current = false;
      try {
        abortRef.current?.abort();
      } catch {
        // ignore
      }
    };
  }, []);

  const paramsKey = useMemo(() => JSON.stringify({ organizationId: organizationId || null }), [organizationId]);

  const shallowArrayEqual = (a = [], b = []) => {
    if (a === b) return true;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      const x = a[i];
      const y = b[i];
      if (!x || !y) return false;
      if (x.label !== y.label || x.value !== y.value || x.delta !== y.delta) return false;
    }
    return true;
  };

  const load = useCallback(async () => {
    if (inflightRef.current && paramsKeyRef.current === paramsKey) {
      if (process.env.NODE_ENV !== 'test') {
        // eslint-disable-next-line no-console
        console.debug('[useOverviewKpis] skip duplicate in-flight', { organizationId });
      }
      return;
    }

    inflightRef.current = true;
    paramsKeyRef.current = paramsKey;

    if (mountedRef.current) {
      setLoading(true);
      setError(null);
    }

    try {
      if (process.env.NODE_ENV !== 'test') {
        // eslint-disable-next-line no-console
        console.debug('[useOverviewKpis] fetch start', { organizationId });
      }
      const totals = await fetchOverviewTotals({
        organizationId,
        signal: abortRef.current?.signal,
      });
      const mapped = adaptOverviewTotalsToKpis(totals);

      if (mountedRef.current && !shallowArrayEqual(mapped, lastKpisRef.current)) {
        setKpis(mapped);
        lastKpisRef.current = mapped;
      }

      if (process.env.NODE_ENV !== 'test') {
        // eslint-disable-next-line no-console
        console.debug('[useOverviewKpis] fetch success', { kpisCount: mapped.length });
      }
    } catch (e) {
      if (e?.name === 'AbortError') {
        if (process.env.NODE_ENV !== 'test') {
          // eslint-disable-next-line no-console
          console.debug('[useOverviewKpis] aborted');
        }
      } else {
        if (process.env.NODE_ENV !== 'test') {
          // eslint-disable-next-line no-console
          console.debug('[useOverviewKpis] fetch error', { message: e?.message });
        }
        if (mountedRef.current) setError(e?.message || 'Failed to load KPIs');
      }
    } finally {
      if (mountedRef.current) setLoading(false);
      inflightRef.current = false;
    }
  }, [organizationId, paramsKey]);

  useEffect(() => {
    // load on mount and when organization changes (via stable paramsKey)
    load();
  }, [load]);

  return { kpis, loading, error, reload: load };
}
