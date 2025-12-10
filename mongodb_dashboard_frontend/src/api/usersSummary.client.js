import qs from 'query-string';

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
  if (range === 'custom') {
    if (start_date) params.start_date = start_date;
    if (end_date) params.end_date = end_date;
  }
  const url = `/api/users/summary?${qs.stringify(params)}`;
  const res = await fetch(url, { headers: { 'content-type': 'application/json' } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Users summary failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data; // { buckets: [{key,label,count}], range, start_date, end_date }
}
