import client from './client';
import { buildFilterParam } from './buildFilterParam';

/**
 * Ensure the llm-costs document preserves users and projects arrays if provided by backend.
 * We also guard against missing/null values without reshaping nested structures.
 */
function passThroughUsersProjects(item) {
  const users = Array.isArray(item?.users) ? item.users : [];
  const projects = Array.isArray(item?.projects) ? item.projects : [];
  return { ...item, users, projects };
}

// PUBLIC_INTERFACE
/**
 * Fetch a paginated list of LLM cost documents from /api/llm-costs.
 * If the backend returns an envelope, it is preserved with users/projects arrays passed through on each item.
 * If the backend returns a raw array, we return an array with users/projects normalized to arrays.
 */
export async function listLlmCosts({ page, limit, sort, filter, organization_id, tenant_id } = {}) {
  const params = {};
  if (page) params.page = page;
  if (limit) params.limit = limit;
  if (sort) params.sort = sort;
  if (organization_id) params.organization_id = organization_id;
  if (tenant_id) params.tenant_id = tenant_id;
  if (filter) {
    params.filter = buildFilterParam(filter);
  }

  const res = await client.get('/api/llm-costs', { params });

  // Pass through envelope or array while preserving users/projects arrays intact.
  if (res && res.data) {
    if (Array.isArray(res.data)) {
      return res.data.map(passThroughUsersProjects);
    }
    if (res.data && Array.isArray(res.data.data)) {
      return {
        ...res.data,
        data: res.data.data.map(passThroughUsersProjects),
      };
    }
  }
  return res.data;
}

// PUBLIC_INTERFACE
/**
 * Normalizes envelope or raw array responses to a consistent shape
 * { success, data, meta }, while preserving users/projects on items.
 */
export function normalizeEnvelope(response) {
  if (response && typeof response === 'object' && Array.isArray(response.data) && response.meta) {
    return {
      success: typeof response.success === 'boolean' ? response.success : true,
      data: response.data.map(passThroughUsersProjects),
      meta: {
        page: response.meta.page || 1,
        limit: response.meta.limit || (response.data?.length || 20),
        total: typeof response.meta.total === 'number' ? response.meta.total : (response.data?.length || 0),
      },
    };
  }
  if (response && typeof response === 'object' && Array.isArray(response.items)) {
    return {
      success: true,
      data: response.items.map(passThroughUsersProjects),
      meta: {
        page: response.page || 1,
        limit: response.limit || (response.items?.length || 20),
        total: typeof response.total === 'number' ? response.total : (response.items?.length || 0),
      },
    };
  }
  if (Array.isArray(response)) {
    return {
      success: true,
      data: response.map(passThroughUsersProjects),
      meta: {
        page: 1,
        limit: response.length,
        total: response.length,
      },
    };
  }
  return {
    success: false,
    data: [],
    meta: { page: 1, limit: 20, total: 0 },
  };
}

const llmCostsApi = {
  listLlmCosts,
  normalizeEnvelope,
};
export default llmCostsApi;
