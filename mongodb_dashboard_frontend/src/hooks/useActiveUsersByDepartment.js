/**
 * Hook: useActiveUsersByDepartment
 * Wraps usersInsights API client: getActiveUsersByDepartment
 * Exposes { data, loading, error, refresh }
 * Re-fetches on parameter changes and memoizes results.
 */

import usersInsights from '../api/usersInsights';
import { useApiQuery } from './utils';

// PUBLIC_INTERFACE
export default function useActiveUsersByDepartment({ from, to, tenantId } = {}) {
  const fetcher = async (p = {}) => {
    const { from: f, to: t, tenantId: tid } = p;
    return usersInsights.getActiveUsersByDepartment({ from: f, to: t, tenant_id: tid });
  };

  const params = { from, to, tenantId };
  return useApiQuery('useActiveUsersByDepartment', fetcher, params);
}
