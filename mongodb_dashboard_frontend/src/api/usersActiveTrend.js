import client from './client';

/**
 * PUBLIC_INTERFACE
 * Fetch active users trend with optional tenant filter.
 */
export async function getActiveUsersTrend({ from, to, granularity = 'day', status = 'completed|active', tenant_id } = {}) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (granularity) params.set('granularity', granularity);
  if (status) params.set('status', status);
  if (tenant_id) params.set('tenant_id', tenant_id);
  const query = params.toString();
  const url = query ? `/api/users/active-trend?${query}` : `/api/users/active-trend`;
  const res = await client.get(url);
  return res.data;
}
