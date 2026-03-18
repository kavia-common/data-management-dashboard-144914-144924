import { getApiClient } from './baseClient';
import { buildFilterParam } from './buildFilterParam';
import { buildQueryString } from './util';

/**
 * PUBLIC_INTERFACE
 * fetchSessionTracking
 *
 * Canonical Session Tracking list API client.
 *
 * Contract:
 * Inputs:
 *  - page?: number
 *  - limit?: number
 *  - tenant_id?: string (scope; baseClient also enforces/derives tenant_id)
 *  - sort?: string
 *  - q?: string (server-side multi-field text search)
 *  - filter?: object (server-side JSON filter; will be JSON-stringified into `filter` query param)
 *  - user_name?: string (convenience alias; applied as strict server-side filter: { user_name: <trimmed> })
 *
 * Output:
 *  - Promise<{ items: any[], total: number, meta: any }>
 *
 * Notes / invariants:
 *  - When `user_name` is provided, it is applied as a strict filter (exact match) so that
 *    pagination across all pages returns sessions for that user only.
 *  - If both `filter.user_name` and `user_name` are provided, `user_name` wins.
 *  - The backend may return either a raw array or an envelope { data, meta }.
 */
export async function fetchSessionTracking(params = {}) {
  const {
    page,
    limit,
    tenant_id,
    sort,
    q,
    filter,
    user_name,
  } = params || {};

  const safeParams = {};
  if (page !== undefined) safeParams.page = page;
  if (limit !== undefined) safeParams.limit = limit;
  if (tenant_id !== undefined) safeParams.tenant_id = tenant_id;
  if (sort !== undefined) safeParams.sort = sort;
  if (q !== undefined) safeParams.q = q;

  // Build effective filter, enforcing strict user_name filtering when provided.
  const effectiveFilter = (filter && typeof filter === 'object' && !Array.isArray(filter))
    ? { ...filter }
    : {};

  const normalizedUserName = typeof user_name === 'string' ? user_name.trim() : '';
  if (normalizedUserName) {
    effectiveFilter.user_name = normalizedUserName;
  }

  // Only send filter when it's non-empty, to avoid confusing intermediaries/caches.
  if (Object.keys(effectiveFilter).length > 0) {
    // Use the existing shared serializer to ensure consistent encoding with other modules.
    safeParams.filter = buildFilterParam(effectiveFilter);
  }

  const qs = buildQueryString(safeParams);
  const url = `/api/session-tracking${qs}`;

  // Debuggability: baseClient logs the final URL in non-production.
  const res = await getApiClient().get(url);
  const payload = res?.data ?? res;

  const items = Array.isArray(payload) ? payload : payload?.data ?? [];
  const total =
    (payload && payload.meta && typeof payload.meta.total === 'number' && payload.meta.total) ||
    (Array.isArray(items) ? items.length : 0);
  const meta = payload?.meta ?? null;

  return { items, total, meta };
}

/* No default export to favor named exports (lint rule) */
