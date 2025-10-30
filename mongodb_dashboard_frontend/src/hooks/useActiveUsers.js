/**
 * Hook: useActiveUsers
 * Wraps usersInsights API client: getActiveUsers
 * Exposes { data, loading, error, refresh }
 * Re-fetches on parameter changes and memoizes results.
 */

import usersInsights from '../api/usersInsights';
import { useApiQuery } from './utils';

// PUBLIC_INTERFACE
export default function useActiveUsers({ period = 'daily', from, to, tenantId } = {}) {
  /**
   * fetcher accepts params and calls the appropriate API client method.
   * The usersInsights client is expected to accept filters via query params.
   */
  const fetcher = async (p = {}) => {
    const { period: prd, from: f, to: t, tenantId: tid } = p;
    // API expects period primarily; from/to optional for future backend support
    return usersInsights.getActiveUsers({ period: prd, from: f, to: t, tenant_id: tid });
  };

  const params = { period, from, to, tenantId };
  return useApiQuery('useActiveUsers', fetcher, params);
}
