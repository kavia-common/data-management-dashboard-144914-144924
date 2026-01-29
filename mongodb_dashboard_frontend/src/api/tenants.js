import { apiGet } from "../utils/api";
import { normalizeTenantId } from "../utils/tenantClient";

/**
 * PUBLIC_INTERFACE
 * fetchTenantsForDropdown
 * Fetches the list of tenants that the current user is authorized to see, and normalizes
 * the response into dropdown-friendly objects.
 *
 * Backend source:
 * - GET /api/session/tenants (existing, documented in backend OpenAPI)
 *
 * Return shape:
 * - Always returns an array of { id: string, name: string }
 * - Never throws for non-critical usage: callers can choose to catch; this helper throws
 *   only when apiGet throws (network/auth), and UI should handle with fallback.
 *
 * @returns {Promise<Array<{id: string, name: string}>>}
 */
export async function fetchTenantsForDropdown() {
  const payload = await apiGet("/api/session/tenants", {
    // This endpoint is auth-scoped; include cookies when present.
    // Note: utils/api currently sets credentials:'omit' (existing behavior).
    // In environments relying on cookies only, ensure authTokenProvider uses Authorization header,
    // or adjust utils/api to include credentials globally (not part of this change).
  });

  const raw =
    Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : payload?.data;

  const list = Array.isArray(raw) ? raw : [];

  const mapped = list
    .map((t) => {
      const id = normalizeTenantId(t);
      if (!id) return null;
      const name = t?.tenant_name || t?.name || id;
      return { id: String(id), name: String(name) };
    })
    .filter(Boolean);

  // De-dupe and sort for stable UX.
  const uniqueMap = new Map();
  mapped.forEach((t) => uniqueMap.set(t.id, t));
  return Array.from(uniqueMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export default { fetchTenantsForDropdown };
