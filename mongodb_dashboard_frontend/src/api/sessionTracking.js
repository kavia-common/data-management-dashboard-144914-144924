import { getApiClient } from './baseClient';

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
  /**
   * Contract:
   * - Always call the session-tracking list endpoint using the baseClient param-merging flow.
   * - Never pre-build a URL querystring here, to avoid duplicate query composition across callers.
   */
  const { page, limit, tenant_id, sort, q } = params || {};

  const safeParams = {};
  if (page !== undefined) safeParams.page = page;
  if (limit !== undefined) safeParams.limit = limit;
  if (tenant_id !== undefined) safeParams.tenant_id = tenant_id;
  if (sort !== undefined) safeParams.sort = sort;
  if (q !== undefined) safeParams.q = q;

  // IMPORTANT:
  // Use the table-specific endpoint so table filters/search do not couple to analytics endpoints.
  // Backend behavior and response shapes remain the same as /api/session-tracking.
  const res = await getApiClient().get("/api/session-tracking/table", { params: safeParams });

  /**
   * baseClient.get() returns an axios-like shape: { data: <payload> }.
   * For session-tracking table, backend payload is either:
   *  - Array<row>  (non-paginated)
   *  - { success: boolean, data: Array<row>, meta: {...} } (paginated/envelope)
   */
  const payload = res?.data;

  const items = Array.isArray(payload) ? payload : payload?.data ?? [];
  const total =
    (payload && payload.meta && typeof payload.meta.total === "number" && payload.meta.total) ||
    (Array.isArray(items) ? items.length : 0);
  const meta = payload?.meta ?? null;

  return { items, total, meta };
}

/* No default export to favor named exports (lint rule) */
