import { getApiClient } from "./baseClient";

/**
 * PUBLIC_INTERFACE
 * fetchSessionTrackingTenantIds
 *
 * Fetches all distinct tenant_id values present in the session_tracking dataset.
 *
 * Backend source:
 * - GET /api/session-tracking/tenants/distinct
 *
 * Contract:
 * - Inputs:
 *   - options.signal?: AbortSignal
 * - Outputs:
 *   - Array<{ id: string, name: string }>
 *     (name is intentionally the same as id because Session Tracking UI displays tenant_id)
 * - Errors:
 *   - Throws on non-2xx responses (caller decides fallback behavior)
 *
 * Notes:
 * - This endpoint is dataset-derived, unlike /api/session/tenants which is RBAC/user-derived.
 * - Sorting is handled server-side, but we also sort defensively for stable UX.
 */
export async function fetchSessionTrackingTenantIds(options = {}) {
  const res = await getApiClient().get("/api/session-tracking/tenants/distinct", {
    signal: options?.signal,
  });

  const payload = res?.data ?? res;
  const raw = Array.isArray(payload?.items)
    ? payload.items
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload)
        ? payload
        : [];

  const items = raw
    .map((t) => (t == null ? "" : String(t).trim()))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
    .map((id) => ({ id, name: id }));

  // De-dupe (defense in depth)
  const unique = new Map();
  items.forEach((it) => unique.set(it.id, it));
  return Array.from(unique.values());
}

export default { fetchSessionTrackingTenantIds };
