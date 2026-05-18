import { apiGet } from "../utils/api";
import { normalizeTenantId } from "../utils/tenantClient";
import { createSingleFlight } from "../utils/singleFlight";

/**
 * We single-flight /api/session/tenants to avoid duplicate/racing calls.
 * This prevents noisy "cancelled" requests in the Network tab when multiple components
 * mount/unmount or when StrictMode causes effect re-runs.
 */
const sessionTenantsSingleFlight = createSingleFlight(async ({ signal }) => {
  return apiGet("/api/session/tenants", {
    // This endpoint is auth/session-scoped; include cookies (matches attached curl behavior).
    credentials: "include",
    signal,
  });
});

/**
 * PUBLIC_INTERFACE
 * fetchTenantsForDropdown
 * Fetches the list of tenants that the current user is authorized to see, and normalizes
 * the response into dropdown-friendly objects.
 *
 * Backend source:
 * - GET /api/session/tenants (existing, documented in backend OpenAPI)
 *
 * Behavior changes (intentional):
 * - Concurrent calls are deduped (single-flight).
 * - AbortError returns [] (quiet).
 * - 401 returns [] (quiet) so callers can fallback without logging/retrying noise.
 *
 * @param {Object} [options]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<Array<{id: string, name: string}>>}
 */
export async function fetchTenantsForDropdown(options = {}) {
  let payload;
  try {
    payload = await sessionTenantsSingleFlight.run({ signal: options?.signal });
  } catch (e) {
    // Treat cancellations as benign "no data" results.
    if (e?.name === "AbortError") return [];
    // Unauthorized should be handled quietly (caller may fallback to users-derived tenants).
    if (e?.status === 401) return [];
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
