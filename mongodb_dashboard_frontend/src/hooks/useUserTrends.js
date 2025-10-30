/**
 * Hook: useUserTrends
 * Wraps usersInsights API client: getTrends / getEngagementTrend depending on availability
 * Exposes { data, loading, error, refresh }
 * Re-fetches on parameter changes and memoizes results.
 */

import usersInsights from '../api/usersInsights';
import { useApiQuery } from './utils';

// PUBLIC_INTERFACE
export default function useUserTrends({ from, to, granularity = 'day', tenantId } = {}) {
  const fetcher = async (p = {}) => {
    const { from: f, to: t, granularity: g, tenantId: tid } = p;
    // Prefer engagement trend (users + sessions) if available, otherwise fall back to basic trends
    if (typeof usersInsights.getEngagementTrend === 'function') {
      return usersInsights.getEngagementTrend({ from: f, to: t, granularity: g, tenant_id: tid });
    }
    return usersInsights.getTrends({ from: f, to: t, granularity: g, tenant_id: tid });
  };

  const params = { from, to, granularity, tenantId };
  return useApiQuery('useUserTrends', fetcher, params);
}
