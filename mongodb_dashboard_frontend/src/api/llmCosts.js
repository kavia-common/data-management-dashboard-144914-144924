import client from './client'
import { getApiBaseUrl } from './config'
import { buildFilterParam } from './buildFilterParam'
import urlOverrides from './urlOverrides'

/**
 * PUBLIC_INTERFACE
 * Fetch paginated LLM costs document list (raw docs, no aggregation).
 * Params:
 *  - organizationId (alias tenant_id)
 *  - page (default 1)
 *  - limit (default 20)
 *  - sort (optional, e.g., '-timestamp')
 *  - from, to (ISO strings) optional
 *  - filter (object) optional
 * Returns: { success, data: [], meta }
 */
export async function fetchLlmCosts({ organizationId, page = 1, limit = 20, sort, from, to, filter } = {}) {
  const baseUrl = getApiBaseUrl()
  const path = urlOverrides?.llmCostsPath || '/api/llm-costs'
  const url = new URL(path, baseUrl)

  if (page) url.searchParams.set('page', String(page))
  if (limit) url.searchParams.set('limit', String(limit))
  if (sort) url.searchParams.set('sort', String(sort))
  if (from) url.searchParams.set('from', String(from))
  if (to) url.searchParams.set('to', String(to))

  // Prefer explicit query param; some environments might use header via client
  if (organizationId) {
    url.searchParams.set('organization_id', String(organizationId))
  }

  if (filter && typeof filter === 'object') {
    // Reuse existing filter param builder to safely stringify
    const filterStr = buildFilterParam(filter)
    if (filterStr) url.searchParams.set('filter', filterStr)
  }

  const response = await client.get(url.toString(), {
    headers: organizationId ? { 'x-organization-id': String(organizationId) } : undefined,
    // Allow callers to pass abort signal via client config if supported
    ...(typeof AbortController !== 'undefined' ? {} : {}),
  })

  // Lightweight verification log: sample record (first item) to ensure nested docs
  try {
    const arr = response?.data?.data
    if (Array.isArray(arr) && arr.length > 0) {
      // eslint-disable-next-line no-console
      console.debug('[llmCosts] sample record', arr[0])
    } else {
      // eslint-disable-next-line no-console
      console.debug('[llmCosts] no records found')
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.debug('[llmCosts] sample log failed', e)
  }

  return response?.data
}

export default {
  fetchLlmCosts,
}
