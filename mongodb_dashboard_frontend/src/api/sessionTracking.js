import { getApiClient } from './baseClient';
import { buildQueryString } from './util';

/**
 * PUBLIC_INTERFACE
 * fetchSessionTracking
 * Fetch session tracking records with pagination, sorting, and optional text search.
 * Date range parameters (start/end or from/to) are no longer used by the frontend.
 * Tenant scoping is enforced via tenant_id only (handled by baseClient).
 * Supports lightweight text search via ?q which includes multiple fields on backend.
 *
 * @param {Object} params
 * @param {number} [params.page]
 * @param {number} [params.limit]
 * @param {string} [params.tenant_id] Active tenant scope (alias: organization_id on server)
 * @param {string} [params.sort]
 * @param {string} [params.q] Text search query
 * @returns {Promise<{ items: Array<any>, total: number, meta: any }>}
 */
// PUBLIC_INTERFACE
export async function fetchSessionTracking(params = {}) {
  const {
    page, limit, tenant_id, sort, q,
    // ignore any deprecated params that callers might send
  } = params || {};

  const safeParams = {};
  if (page !== undefined) safeParams.page = page;
  if (limit !== undefined) safeParams.limit = limit;
  if (tenant_id !== undefined) safeParams.tenant_id = tenant_id;
  if (sort !== undefined) safeParams.sort = sort;
  if (q !== undefined) safeParams.q = q;

  const qs = buildQueryString(safeParams);
  const url = `/api/session-tracking${qs}`;
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
