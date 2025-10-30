import { getApiClient } from './client';

/**
 * PUBLIC_INTERFACE
 * getAgentsAggregation
 * Fetch agents aggregation grouped by agent.
 */
export async function getAgentsAggregation(params = {}) {
  const api = getApiClient();
  // IMPORTANT: use relative path WITHOUT leading slash to prevent /api/api duplication
  const res = await api.get('analytics/agents', {
    params: { grouping: 'agent', ...params },
  });

  // Normalize: support raw array or envelope, and normalize field names used by Overview
  const data = res?.data;
  // eslint-disable-next-line no-console
  console.debug("[api.analyticsAgents] getAgentsAggregation response:", data);
  const items = Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data)
    ? data
    : [];
  const normalized = items.map((it) => ({
    agent_name: it.agent_name || it.agent || 'Unknown',
    total_cost: Number(it.total_cost ?? it.cost ?? 0),
    total_usage: typeof it.total_usage === 'number' ? it.total_usage : Number(it.total_tokens ?? 0),
    session_count: typeof it.session_count === 'number' ? it.session_count : Number(it.sessions ?? 0),
    source_breakdown: it.source_breakdown || {},
  }));
  const total =
    typeof data?.total === 'number'
      ? data.total
      : data?.meta && typeof data.meta.total === 'number'
      ? data.meta.total
      : normalized.length;
  return { items: normalized, total, meta: data?.meta ?? null };
}

/**
 * PUBLIC_INTERFACE
 * getDepartmentAggregation
 * Fetch costs grouped by department.
 */
export async function getDepartmentAggregation(params = {}) {
  const api = getApiClient();
  // IMPORTANT: use relative path WITHOUT leading slash to prevent /api/api duplication
  const res = await api.get('analytics/agents', {
    params: { grouping: 'department', ...params },
  });

  const data = res?.data;
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
