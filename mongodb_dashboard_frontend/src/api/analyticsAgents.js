import { getApiClient } from './client';

/**
 * PUBLIC_INTERFACE
 * getAgentsAggregation
 * Fetch agents aggregation grouped by agent.
 */
export async function getAgentsAggregation(params = {}) {
  const api = getApiClient();
  const res = await api.get('analytics/agents', {
    params: { grouping: 'agent', ...params },
  });

  // Normalize: support raw array or envelope
  const data = res?.data;
  // eslint-disable-next-line no-console
  console.debug("[api.analyticsAgents] getAgentsAggregation response:", data);
  if (Array.isArray(data)) return { items: data, total: data.length, meta: null };
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

/**
 * PUBLIC_INTERFACE
 * getDepartmentAggregation
 * Fetch costs grouped by department.
 */
export async function getDepartmentAggregation(params = {}) {
  const api = getApiClient();
  const res = await api.get('/analytics/agents', {
    params: { grouping: 'department', ...params },
  });

  const data = res?.data;
  if (Array.isArray(data)) return { items: data, total: data.length, meta: null };
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
