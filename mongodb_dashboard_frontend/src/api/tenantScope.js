import { getOrganizationId } from "./authTokenProvider";

/**
 * Tenant scoping helpers for API requests.
 *
 * Backend contract (per error message / API docs):
 * - Preferred: send tenant scope via request header `x-organization-id`
 * - Legacy fallback: `?tenant_id=` or `?organization_id=`
 *
 * This module centralizes how we scope requests to avoid “patchy” per-call fixes.
 */

/**
 * PUBLIC_INTERFACE
 * resolveEffectiveTenantId
 * Resolve the tenant id we should use for scoping.
 *
 * Inputs:
 * - explicitTenantId?: string | null   (e.g., Users Analytics tenant filter dropdown)
 *
 * Output:
 * - string | null: the effective tenant id, or null if none can be resolved
 *
 * Notes:
 * - We prefer the explicitly selected tenant when provided.
 * - Otherwise we fall back to the organization id from auth token provider storage.
 */
export function resolveEffectiveTenantId(explicitTenantId) {
  const explicit =
    explicitTenantId !== undefined && explicitTenantId !== null && String(explicitTenantId).trim() !== ""
      ? String(explicitTenantId)
      : null;

  return explicit || getOrganizationId() || null;
}

/**
 * PUBLIC_INTERFACE
 * applyTenantScopeToRequest
 * Applies tenant scoping to an API request options object.
 *
 * Contract:
 * Inputs:
 * - request: {
 *     headers?: Record<string, string>,
 *     params?: Record<string, any>
 *   }
 * - tenantId?: string | null
 * - options?: {
 *     preferHeader?: boolean (default true)
 *     legacyQueryFallback?: boolean (default false)
 *     legacyQueryKey?: 'tenant_id'|'organization_id' (default 'tenant_id')
 *     debugLabel?: string
 *   }
 *
 * Output:
 * - { headers, params } (new objects; does not mutate input)
 *
 * Behavior:
 * - When tenantId is provided:
 *   - sets header `x-organization-id` (unless preferHeader=false)
 *   - optionally also sets a legacy query param (tenant_id by default)
 * - When tenantId is absent:
 *   - returns shallow-cloned headers/params with no tenant modifications
 *
 * Failure modes:
 * - Never throws; safe to call in any request-building path.
 */
export function applyTenantScopeToRequest(request = {}, tenantId, options = {}) {
  const {
    preferHeader = true,
    legacyQueryFallback = false,
    legacyQueryKey = "tenant_id",
    debugLabel = "",
  } = options;

  const headers = { ...(request.headers || {}) };
  const params = { ...(request.params || {}) };

  const tid = tenantId ? String(tenantId) : null;
  if (!tid) return { headers, params };

  if (preferHeader) {
    headers["x-organization-id"] = tid;
  }

  if (legacyQueryFallback) {
    // Only set if caller didn't already specify one.
    if (params[legacyQueryKey] === undefined || params[legacyQueryKey] === null || params[legacyQueryKey] === "") {
      params[legacyQueryKey] = tid;
    }
  }

  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.debug("[api/tenantScope] applied", {
      debugLabel,
      tenantId: tid,
      headerApplied: preferHeader,
      legacyQueryApplied: legacyQueryFallback ? legacyQueryKey : null,
    });
  }

  return { headers, params };
}
