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
  tenantId,
  filter,
} = {}) {
  const baseUrl = getApiBase()
  const url = new URL('/api/llm_costs', baseUrl)

  url.searchParams.set('page', String(page))
  url.searchParams.set('limit', String(limit))

  // Tenant scoping:
  // - Always send x-organization-id header when we have an org/tenant id.
  // - Also provide query aliases, since some backends accept tenant_id vs organization_id.
  const resolvedTenant = tenantId || organizationId
  if (resolvedTenant) {
    url.searchParams.set('organization_id', String(resolvedTenant))
    url.searchParams.set('tenant_id', String(resolvedTenant))
  }

  if (filter && typeof filter === 'object') {
    const filterStr = buildFilterParam(filter)
    if (filterStr) url.searchParams.set('filter', filterStr)
  }

  const resp = await client.get(url.toString(), {
    headers: resolvedTenant ? { 'x-organization-id': String(resolvedTenant) } : undefined,
  })

  return resp?.data
}

export default {
  fetchLlmCostsUnderscore,
}
