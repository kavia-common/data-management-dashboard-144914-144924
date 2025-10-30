import { getApiClient } from './client';

/**
 * PUBLIC_INTERFACE
 * getAgentsAnalytics
 * Fetch grouped analytics by agent (grouping=agent).
 * Params: { tenant_id?, project_id?, from?, to?, limit?, offset? }
 * Returns normalized payload: { items: [], total, meta }
 */
export async function getAgentsAnalytics(params = {}) {
  const api = getApiClient();
  const { data } = await api.get('/analytics/agents', {
    params: { grouping: 'agent', ...params },
  });

  // Normalize shapes: array or { items/data, meta }
  if (Array.isArray(data)) {
    return { items: data, total: data.length, meta: null };
  }
  const items = Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data)
    ? data
    : [];
  const total =
    typeof data?.total === 'number'
      ? data.total
      : data?.meta && typeof data.meta.total === 'number'
      ? data.meta.total
      : items.length;

  return { items, total, meta: data?.meta ?? null };
}

export default { getAgentsAnalytics };
