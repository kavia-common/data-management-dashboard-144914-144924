import api from './baseClient';

/**
 * PUBLIC_INTERFACE
 * Fetch analytics grouped by agents.
 * Accepts optional filters: tenant_id, project_id, from, to, limit, offset.
 * Returns array of items [{ agent_name, total_cost, total_minutes, total_usage, ... }] or envelope depending on backend.
 */
export async function getAgentsAnalytics(params = {}) {
  /** This is a public function. */
  // Normalize and pass only known filters to avoid leaking extraneous keys
  const {
    tenant_id,
    project_id,
    from,
    to,
    limit,
    offset,
  } = params || {};

  const query = {
    ...(tenant_id ? { tenant_id } : {}),
    ...(project_id ? { project_id } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(limit ? { limit } : {}),
    ...(offset ? { offset } : {}),
  };

  const response = await api.get('/api/analytics/agents', { params: query });
  // Normalize to { items, total } shape if backend returns array
  if (Array.isArray(response.data)) {
    return { items: response.data, total: response.data.length };
  }
  if (response.data && Array.isArray(response.data.items)) {
    return response.data;
  }
  // Fallback to wrapping the data as single item if object
  if (response.data && typeof response.data === 'object') {
    return { items: [response.data], total: 1 };
  }
  return { items: [], total: 0 };
}

export default {
  getAgentsAnalytics,
};
