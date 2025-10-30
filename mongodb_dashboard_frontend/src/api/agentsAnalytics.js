import { getApiClient } from './index';

/**
 * PUBLIC_INTERFACE
 * getAgentsAnalytics
 * Fetch grouped analytics by agent.
 * Supports optional filters: tenant_id, project_id, from, to, limit, offset
 * Returns a normalized payload: { items: [], total, meta }
 */
export async function getAgentsAnalytics(params = {}) {
  const client = getApiClient();
  const { data } = await client.get('/api/analytics/agents' + buildQuery(params));
  // Normalize common shapes: array or { items/data, meta }
  if (Array.isArray(data)) {
    return { items: data, total: data.length, meta: null };
  }
  const items = Array.isArray(data?.items) ? data.items
    : Array.isArray(data?.data) ? data.data
    : Array.isArray(data) ? data
    : [];
  const total = typeof data?.total === 'number'
    ? data.total
    : (data?.meta && typeof data.meta.total === 'number' ? data.meta.total : items.length);
  return { items, total, meta: data?.meta ?? null };
}

/** Build a URL query string from params (skips null/undefined/empty string). */
function buildQuery(params = {}) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    usp.append(k, String(v));
  });
  const qs = usp.toString();
  return qs ? `?${qs}` : '';
}

export default { getAgentsAnalytics };
