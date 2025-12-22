/**
 * PUBLIC_INTERFACE
 * fetchLlmCosts
 * Fetch paginated LLM costs from backend.
 * Supports optional filtering by organization_id (tenant) and user_id via query params.
 * Params:
 *   - organization_id: string (alias tenant_id handled by api utils)
 *   - user_id: string (optional)
 *   - page: number
 *   - limit: number
 *   - sort: string (e.g., "-timestamp")
 */
import { apiGet } from '../utils/api';

// PUBLIC_INTERFACE
export async function fetchLlmCosts({ organization_id, user_id, page = 1, limit = 10, sort } = {}) {
  // Build query string
  const params = new URLSearchParams();
  if (typeof page === 'number' && page > 0) params.set('page', String(page));
  if (typeof limit === 'number' && limit > 0) params.set('limit', String(limit));
  if (sort) params.set('sort', String(sort));
  if (user_id) params.set('user_id', String(user_id)); // optional user filter

  // apiGet will ensure organization_id is appended if not present
  const path = `/llm_costs?${params.toString()}`;
  const payload = await apiGet(path, { organization_id });
  // Normalize shape: { success, data, meta }
  if (payload && typeof payload === 'object' && Array.isArray(payload.data) && payload.meta) {
    return payload;
  }
  // Fallback safety
  return { success: true, data: Array.isArray(payload) ? payload : [], meta: { page, limit, total: Array.isArray(payload) ? payload.length : 0 } };
}

export default { fetchLlmCosts }
