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
export async function fetchTenantsForDropdown(options = {}) {
  let payload;
  try {
    payload = await apiGet("/api/session/tenants", {
      // This endpoint is auth/session-scoped; include cookies (matches attached curl behavior).
      credentials: "include",
      signal: options?.signal,
    });
  } catch (e) {
    // Treat cancellations as a benign "no data" result so UIs unmounting mid-request
    // don't flash errors or trigger noisy fallbacks.
    if (e?.name === "AbortError") return [];
    // Preserve existing behavior: 401 (and other errors) should still be handled by the caller,
    // which already performs fallback-to-users for resiliency.
    throw e;
  }

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
