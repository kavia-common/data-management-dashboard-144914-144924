import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchActiveTrend, fetchKpiSummary, fetchUsersByDepartment, fetchUsersByOrganization, fetchJoinedTrend } from '../api/usersAnalytics';
import useDebouncedValue from './useDebouncedValue';

const DEFAULT_FILTERS = {
  granularity: 'daily',
  startDate: null,
  endDate: null,
  department: '',
  organization_id: '',
  is_admin: '',
  status: '',
  search: '',
};

function normalizeGranularity(g) {
  if (g === 'daily') return 'day';
  if (g === 'weekly') return 'week';
  if (g === 'monthly') return 'month';
  return g || 'day';
}

// PUBLIC_INTERFACE
export function useUsersAnalyticsData(initialFilters = {}, options = {}) {
  /**
   * Hook to fetch and manage Users Analytics datasets with debounced filter changes.
   * Options:
   *  - refreshKey?: number - when changed, forces a refetch even if filters unchanged
   */
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS, ...initialFilters });
  const debouncedFilters = useDebouncedValue(filters, 350);
  const refreshKey = options.refreshKey || 0;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [kpis, setKpis] = useState({ totalUsers: null, activeUsers: null, newUsers: null, returningUsers: null });
  const [activeTrend, setActiveTrend] = useState([]);
  const [joinedTrend, setJoinedTrend] = useState([]);
  const [byDept, setByDept] = useState([]);
  const [byOrg, setByOrg] = useState([]);

  const abortRef = useRef(null);

  const updateFilter = useCallback((patch) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const normalizedParams = useMemo(() => {
    return {
      ...debouncedFilters,
      granularity: normalizeGranularity(debouncedFilters.granularity),
    };
  }, [debouncedFilters]);

  useEffect(() => {
    setLoading(true);
    setError(null);

    // Abort control for rapid filter changes
    if (abortRef.current) {
      abortRef.current.aborted = true;
    }
    abortRef.current = { aborted: false };
    const mark = abortRef.current;

    async function run() {
      try {
        const [
          kpiRes,
          activeRes,
          joinedRes,
          deptRes,
          orgRes,
        ] = await Promise.all([
          fetchKpiSummary(normalizedParams),
          fetchActiveTrend(normalizedParams),
          fetchJoinedTrend(normalizedParams),
          fetchUsersByDepartment(normalizedParams),
          fetchUsersByOrganization(normalizedParams),
        ]);
        if (mark.aborted) return;

        setKpis({
          totalUsers: kpiRes.totalUsers ?? null,
          activeUsers: kpiRes.activeUsers ?? null,
          newUsers: kpiRes.newUsers ?? null,
          returningUsers: kpiRes.returningUsers ?? null,
        });
        setActiveTrend(activeRes.items || []);
        setJoinedTrend(Array.isArray(joinedRes) ? joinedRes : (joinedRes?.items || []));
        setByDept(deptRes || []);
        setByOrg(orgRes || []);
      } catch (e) {
        if (!mark.aborted) setError(e?.message || 'Failed to load analytics');
      } finally {
        if (!mark.aborted) setLoading(false);
      }
    }
    run();

    return () => {
      if (abortRef.current) {
        abortRef.current.aborted = true;
      }
    };
    // Trigger on param change and external refreshKey
  }, [normalizedParams, refreshKey]);

  const empty =
    (activeTrend?.length ?? 0) === 0 &&
    (Array.isArray(joinedTrend) ? joinedTrend.length : 0) === 0 &&
    (byDept?.length ?? 0) === 0 &&
    (byOrg?.length ?? 0) === 0 &&
    kpis.totalUsers == null &&
    kpis.activeUsers == null &&
    kpis.newUsers == null &&
    kpis.returningUsers == null;

  return {
    filters,
    setFilters,
    updateFilter,
    loading,
    error,
    empty,
    kpis,
    activeTrend,
    joinedTrend,
    byDept,
    byOrg,
  };
}

export default useUsersAnalyticsData;
