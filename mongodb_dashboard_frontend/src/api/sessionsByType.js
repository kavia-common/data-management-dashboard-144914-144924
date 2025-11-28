import { getApiClient } from './baseClient';
import { buildQueryString } from './util';

// PUBLIC_INTERFACE
export async function fetchSessionsByType(params = {}) {
  /** Fetch aggregated sessions-by-type in a single backend call. */
  const { tenant_id, organization_id, from, to } = params || {};
  const q = {};
  if (tenant_id) q.tenant_id = tenant_id;
  if (!tenant_id && organization_id) q.tenant_id = organization_id; // alias support
  if (from) q.from = from;
  if (to) q.to = to;

  const qs = buildQueryString(q);
  const url = `/api/analytics/sessions-by-type${qs}`;
  const res = await getApiClient().get(url);
  const data = res?.data ?? res;
  const items = Array.isArray(data?.items) ? data.items : [];
  const total = typeof data?.total === 'number' ? data.total : items.reduce((a, b) => a + (b?.count || 0), 0);
  return { items, total, meta: data?.meta || null };
}
