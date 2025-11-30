import client from './client';
import buildFilterParam from './buildFilterParam';

/**
 * PUBLIC_INTERFACE
 * Fetch a paginated list of LLM cost documents.
 * Supports optional filtering by organization_id via header or query params.
 * When page/limit are provided, backend returns { success, data, meta } envelope.
 */
export async function fetchLlmCosts({ page = 1, limit = 20, organization_id, sort, filter } = {}) {
  const params = {};

  if (page) params.page = page;
  if (limit) params.limit = limit;
  if (sort) params.sort = sort;

  // Optional query filter: ignore tenant fields inside filter; server will enforce scoping.
  if (filter && typeof filter === 'object') {
    params.filter = buildFilterParam(filter);
  }

  if (organization_id) {
    // Pass as query param so it works without auth header; backend prioritizes header when JWT present.
    params.organization_id = organization_id;
  }

  const res = await client.get('/api/llm-costs', { params });
  // Return the raw API envelope or array; callers should use response.data (for axios) or normalize it.
  return res.data;
}

/**
 * PUBLIC_INTERFACE
 * Normalizes envelope or raw array responses to a consistent shape
 * { success, data, meta } so callers can rely on pagination controls.
 */
export function normalizeEnvelope(response) {
  // Preferred: { success, data: [], meta: { page, limit, total } }
  if (response && typeof response === 'object' && Array.isArray(response.data) && response.meta) {
    return {
      success: typeof response.success === 'boolean' ? response.success : true,
      data: response.data,
      meta: {
        page: response.meta.page || 1,
        limit: response.meta.limit || (response.data?.length || 20),
        total: typeof response.meta.total === 'number' ? response.meta.total : (response.data?.length || 0),
      },
    };
  }
  // Alternative: { items, page, limit, total }
  if (response && typeof response === 'object' && Array.isArray(response.items)) {
    return {
      success: true,
      data: response.items,
      meta: {
        page: response.page || 1,
        limit: response.limit || (response.items?.length || 20),
        total: typeof response.total === 'number' ? response.total : (response.items?.length || 0),
      },
    };
  }
  // Raw array fallback (no pagination supplied to server)
  if (Array.isArray(response)) {
    return {
      success: true,
      data: response,
      meta: {
        page: 1,
        limit: response.length,
        total: response.length,
      },
    };
  }
  // Unexpected shape
  return {
    success: false,
    data: [],
    meta: { page: 1, limit: 20, total: 0 },
  };
}
// Note: organization_cost is a string like "$3005.442509" from the API; the UI should render this as-is,
// not parse into a number. Use a fallback of "—" when null/undefined/empty.
