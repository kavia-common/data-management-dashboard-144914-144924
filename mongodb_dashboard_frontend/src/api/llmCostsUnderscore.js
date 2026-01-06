import client from './client'
import { getApiBase } from './config'
import { buildFilterParam } from './buildFilterParam'

/**
 * PUBLIC_INTERFACE
 * fetchLlmCostsUnderscore
 *
 * Calls the backend underscore endpoint: /api/llm_costs (pagination supported).
 *
 * Params:
 *  - page (default 1)
 *  - limit (default 10)
 *  - organizationId (optional; passed as query param and x-organization-id header when provided)
 *  - filter (object; will be JSON-stringified via buildFilterParam; use { user_id: "<id>" } to filter by user)
 *
 * Returns:
 *  - Backend envelope: { success, data: Array, meta: { page, limit, total, ... } }
 */
export async function fetchLlmCostsUnderscore({
  page = 1,
  limit = 10,
  organizationId,
  filter,
} = {}) {
  const baseUrl = getApiBase()
  const url = new URL('/api/llm_costs', baseUrl)

  url.searchParams.set('page', String(page))
  url.searchParams.set('limit', String(limit))

  if (organizationId) {
    url.searchParams.set('organization_id', String(organizationId))
  }

  if (filter && typeof filter === 'object') {
    const filterStr = buildFilterParam(filter)
    if (filterStr) url.searchParams.set('filter', filterStr)
  }

  const resp = await client.get(url.toString(), {
    headers: organizationId ? { 'x-organization-id': String(organizationId) } : undefined,
  })

  return resp?.data
}

export default {
  fetchLlmCostsUnderscore,
}
