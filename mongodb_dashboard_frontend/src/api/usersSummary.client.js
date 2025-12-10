import qs from 'query-string';
import { apiGet } from '../utils/api';

/**
 * PUBLIC_INTERFACE
 * fetchUsersSummary
 * Fetches /api/users/summary with range and optional custom date window.
 * Params: { organization_id?, tenant_id?, range='daily'|'weekly'|'monthly'|'custom', start_date?, end_date? }
 */
export async function fetchUsersSummary({ organization_id, tenant_id, range = 'daily', start_date, end_date } = {}) {
  const params = { range };
  if (organization_id) params.organization_id = organization_id;
  // Only add tenant_id when organization_id isn't provided; centralized client prevents double-adding anyway
  if (!params.organization_id && tenant_id) params.tenant_id = tenant_id;
  if (range === 'custom') {
    if (start_date) params.start_date = start_date;
    if (end_date) params.end_date = end_date;
  }

  const path = `/api/users/summary?${qs.stringify(params)}`;

  // Defer base URL resolution and org id propagation to centralized apiGet
  const data = await apiGet(path, {
    headers: { 'content-type': 'application/json' },
    organization_id: organization_id, // optional hint; apiGet also reads from auth context
  });
  return data; // { buckets: [{key,label,count}], range, start_date, end_date }
}
