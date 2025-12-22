import { useEffect, useMemo, useRef, useState } from 'react';
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

  const inflightRef = useRef(null);
  const lastParamsRef = useRef(null);

  const debugPrefix = '[useOverviewKpis]';

  const load = useMemo(
    () => async () => {
      // prevent duplicate in-flight for same params
      const paramsKey = JSON.stringify({ organizationId: organizationId || null });
      if (inflightRef.current && lastParamsRef.current === paramsKey) {
        console.debug(`${debugPrefix} skip duplicate in-flight`, { organizationId });
        return;
      }

      // cancel previous only if different params
      if (inflightRef.current && lastParamsRef.current !== paramsKey) {
        console.debug(`${debugPrefix} cancel previous due to param change`, {
          prev: lastParamsRef.current,
          next: paramsKey,
        });
        inflightRef.current.abort();
      }

      const controller = new AbortController();
      inflightRef.current = controller;
      lastParamsRef.current = paramsKey;

      setLoading(true);
      setError(null);

      try {
        console.debug(`${debugPrefix} fetch start`, { organizationId });
        const totals = await fetchOverviewTotals({
          organizationId,
          signal: controller.signal,
        });
        const mapped = adaptOverviewTotalsToKpis(totals);
        setKpis(mapped);
        console.debug(`${debugPrefix} fetch success`, { kpisCount: mapped.length });
      } catch (e) {
        if (e?.name === 'AbortError') {
          console.debug(`${debugPrefix} aborted`);
        } else {
          console.debug(`${debugPrefix} fetch error`, { message: e?.message });
          setError(e?.message || 'Failed to load KPIs');
        }
      } finally {
        setLoading(false);
      }
    },
    [organizationId]
  );

  useEffect(() => {
    // load on mount and when organization changes
    load();

    // abort only on unmount; not on param changes unless we intentionally changed params above
    return () => {
      if (inflightRef.current) {
        inflightRef.current.abort();
      }
    };
  }, [load]);

  return { kpis, loading, error, reload: load };
}
