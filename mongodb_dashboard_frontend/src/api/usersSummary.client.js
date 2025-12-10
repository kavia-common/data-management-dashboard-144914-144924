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
  if (tenant_id && !organization_id) params.tenant_id = tenant_id;

  // Client-side guard for custom date inputs to avoid unnecessary 400s
  if (range === 'custom') {
    if (start_date) params.start_date = start_date;
    if (end_date) params.end_date = end_date;
    if (!start_date || !end_date) {
      // eslint-disable-next-line no-console
      console.warn('[usersSummary.client] custom range requires start_date and end_date; skipping request');
      return { buckets: [], range, start_date: start_date || null, end_date: end_date || null };
    }
  }

  const query = qs.stringify(params);
  const path = `/api/users/summary?${query}`;

  // Debug logging to verify URL and params
  // eslint-disable-next-line no-console
  console.info('[usersSummary.client] GET', { path, params });

  // Use centralized apiGet to ensure Authorization and organization_id propagation when missing
  const data = await apiGet(path, { headers: { 'content-type': 'application/json' } });

  // eslint-disable-next-line no-console
  console.info('[usersSummary.client] OK', { buckets: data?.buckets?.length ?? 0, range: data?.range });

  return data; // { buckets: [{key,label,count}], range, start_date, end_date }
}
