import { getApiClient } from './baseClient';
import { buildQueryString } from './util';

/**
 * PUBLIC_INTERFACE
 * fetchSessionTracking
 * Fetch session tracking records with pagination, sorting, and optional text search.
 * Note: Backend no longer accepts or applies a 'filter' parameter or date-range compound filters.
 * Tenant scoping is enforced via tenant_id only (handled by baseClient).
 * Supports lightweight text search via ?q which includes service_type field on backend.
 *
 * @param {Object} params
 * @param {number} [params.page]
 * @param {number} [params.limit]
 * @param {string} [params.tenant_id] Active tenant scope (alias: organization_id on server)
 * @param {string} [params.sort]
 * @param {string} [params.q] Text search query (applies to service_type and other fields)
 * @returns {Promise<{ items: Array<any>, total: number, meta: any }>}
 */
export async function fetchSessionTracking(params = {}) {
  const {
    page,
    limit,
    tenant_id,
    sort,
    q,
    user_name,
    User_name,
    // ignore any deprecated params that callers might send
  } = params || {};

  const safeParams = {};
  if (page !== undefined) safeParams.page = page;
  if (limit !== undefined) safeParams.limit = limit;
  if (tenant_id !== undefined) safeParams.tenant_id = tenant_id;
  if (sort !== undefined) safeParams.sort = sort;
  if (q !== undefined) safeParams.q = q;
  // Prefer canonical `User_name` when provided; keep user_name for backwards compat.
  if (User_name !== undefined) safeParams.User_name = User_name;
  else if (user_name !== undefined) safeParams.user_name = user_name;

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
