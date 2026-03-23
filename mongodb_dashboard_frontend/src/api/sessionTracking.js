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
   *
   * Inputs:
   * - params: { page?, limit?, tenant_id?, sort?, q? }
   *
   * Outputs:
   * - { items: Array<object>, total: number, meta: object|null }
   *
   * Errors:
   * - Throws on non-2xx responses (from baseClient).
   *
   * Side effects:
   * - Performs one network GET request.
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
  // Backend behavior and response shapes remain compatible with /api/session-tracking.
  const res = await getApiClient().get("/api/session-tracking/table", { params: safeParams });

  /**
   * Normalize all known backend response shapes into a consistent list payload.
   *
   * Known shapes:
   * 1) Raw array:
   *    - [ ...rows ]
   *
   * 2) Standard envelope:
   *    - { success: true, data: [ ...rows ], meta: { page, limit, total } }
   *
   * 3) Nested envelope (observed in some middleware/controller stacks):
   *    - { success: true, data: { data: [ ...rows ], meta: {...} }, meta?: {...} }
   *
   * Invariant:
   * - items is ALWAYS an array.
   */
  const payload = res?.data;

  let items = [];
  let meta = null;

  if (Array.isArray(payload)) {
    items = payload;
  } else if (payload && typeof payload === "object") {
    // Standard envelope: payload.data is array
    if (Array.isArray(payload.data)) {
      items = payload.data;
      meta = payload.meta ?? null;
    } else if (payload.data && typeof payload.data === "object") {
      // Nested envelope: payload.data.data is array
      if (Array.isArray(payload.data.data)) {
        items = payload.data.data;
        // Prefer inner meta, but fall back to outer meta if present.
        meta = payload.data.meta ?? payload.meta ?? null;
      } else {
        items = [];
        meta = payload.meta ?? null;
      }
    } else {
      items = [];
      meta = payload.meta ?? null;
    }
  }

  const total =
    (meta && typeof meta.total === "number" && meta.total) || (Array.isArray(items) ? items.length : 0);

  return { items, total, meta };
}

/* No default export to favor named exports (lint rule) */
