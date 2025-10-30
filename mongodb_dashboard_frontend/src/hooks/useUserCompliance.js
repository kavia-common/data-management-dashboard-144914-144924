/**
 * Hook: useUserCompliance
 * Wraps usersInsights API client: getCompliance
 * Exposes { data, loading, error, refresh }
 * Re-fetches on parameter changes and memoizes results.
 */

import usersInsights from '../api/usersInsights';
import { useApiQuery } from './utils';

// PUBLIC_INTERFACE
export default function useUserCompliance({
  tenantId,
  inactiveDays,
  requiredFields,
  includeDetails,
  from,
  to,
} = {}) {
  const fetcher = async (p = {}) => {
    const {
      tenantId: tid,
      inactiveDays: inact,
      requiredFields: reqFields,
      includeDetails: include,
      from: f,
      to: t,
    } = p;

    return usersInsights.getCompliance({
      tenant_id: tid,
      inactiveDays: inact,
      requiredFields: reqFields,
      includeDetails: include,
      from: f,
      to: t,
    });
  };

  const params = { tenantId, inactiveDays, requiredFields, includeDetails, from, to };
  return useApiQuery('useUserCompliance', fetcher, params);
}
