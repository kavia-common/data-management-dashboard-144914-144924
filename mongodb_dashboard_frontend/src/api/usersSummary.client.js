import qs from 'query-string';
import { apiGet } from '../utils/api';

/**
 * PUBLIC_INTERFACE
 * fetchUsersSummary
 * Fetches /api/users/summary with range and optional custom date window.
 * Params: { organization_id?, tenant_id?, range='daily'|'weekly'|'monthly'|'custom', start_date?, end_date? }
 * Returns: { buckets: [{ label, key?, start?, end?, count }], range, start_date, end_date }
 */
export async function fetchUsersSummary({ organization_id, tenant_id, range = 'daily', start_date, end_date } = {}) {
  const params = { range };

  // Ensure tenant scoping is present (prefer organization_id)
  if (organization_id) {
    params.organization_id = organization_id;
  } else if (tenant_id) {
    params.tenant_id = tenant_id;
  }

  // Include custom window only when applicable
  if (range === 'custom') {
    if (start_date) params.start_date = start_date;
    if (end_date) params.end_date = end_date;
  }

  const path = `/api/users/summary?${qs.stringify(params)}`;

  // Centralized apiGet handles base URL and header propagation; include explicit org hint
  const data = await apiGet(path, {
    headers: { 'content-type': 'application/json' },
    organization_id: organization_id || tenant_id,
  });
  return data; // { buckets: [{ label, start, end, count }], range, start_date, end_date }
}
