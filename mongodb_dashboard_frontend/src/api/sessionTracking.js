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
 *
 * Output:
 *  - Promise<{ items: any[], total: number, meta: any }>
 *
 * Notes / invariants:
 *  - The backend may return either a raw array or an envelope { data, meta }.
 *  - Username filtering has been removed from the Session Tracking module.
 */
export async function fetchSessionTracking(params = {}) {
  const { page, limit, tenant_id, sort, q, filter } = params || {};

  const safeParams = {};
  if (page !== undefined) safeParams.page = page;
  if (limit !== undefined) safeParams.limit = limit;
  if (tenant_id !== undefined) safeParams.tenant_id = tenant_id;
  if (sort !== undefined) safeParams.sort = sort;
  if (q !== undefined) safeParams.q = q;

  // Only send filter when it's a non-empty object.
  if (filter && typeof filter === 'object' && !Array.isArray(filter) && Object.keys(filter).length > 0) {
    // Use the existing shared serializer to ensure consistent encoding with other modules.
    safeParams.filter = buildFilterParam(filter);
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
