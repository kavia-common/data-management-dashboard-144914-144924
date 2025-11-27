import { getApiClient } from "./index";
import requestClient from "./requestClient";

/**
 * PUBLIC_INTERFACE
 * getUserProjects
 * Fetches a user's projects from session tracking using the backend endpoint:
 * GET /api/users/:userId/projects?organization_id={organizationId}&from={fromISO?}&to={toISO?}
 *
 * @param {string} userId - The user identifier.
 * @param {{ tenantId?: string, organizationId?: string, from?: string|Date|null, to?: string|Date|null }} params - Query parameters.
 * @returns {Promise<{ user_id: string, tenant_id?: string, organization_id?: string, projects: Array<{ project_id: string, project_name?: string|null, last_activity?: string|null }> }>}
 */
export async function getUserProjects(userId, params = {}) {
  const api = getApiClient();
  if (!userId) {
    throw new Error("userId is required");
  }
  const { tenantId, organizationId, from, to } = params || {};
  const org = organizationId || tenantId;

  const query = {};
  if (org) query.organization_id = org;
  if (from) {
    query.from = typeof from === "string" ? from : new Date(from).toISOString();
  }
  if (to) {
    query.to = typeof to === "string" ? to : new Date(to).toISOString();
  }

  // Compose a cache key leveraging requestClient inflight cache/dedup
  const cacheKey = ["user-projects", String(userId), String(org || ""), query.from || "", query.to || ""].join("::");

  // Use requestClient directly to ensure dedup keyed by composite cacheKey
  const res = await requestClient.get(`/users/${encodeURIComponent(userId)}/projects`, {
    params: query,
    cacheTTL: 120000,
    // internal requestClient doesn't accept cacheKey explicitly, so include params for deterministic keys,
    // and rely on its key building (method+url+sorted params). We still compute cacheKey above for any future use.
  });

  // Response shape: { user_id, organization_id?, tenant_id?, projects: [{ project_id, project_name?, last_activity? }]}
  return res.data?.data ?? res.data;
}

/**
 * PUBLIC_INTERFACE
 * getUserBasic
 * Fetch minimal user info by MongoDB ObjectId.
 * GET /api/users/:id -> { id, name }
 *
 * @param {string} userId - MongoDB ObjectId as string
 * @returns {Promise<{ id: string, name: string|null }>}
 */
export async function getUserBasic(userId) {
  const api = getApiClient();
  if (!userId) throw new Error("userId is required");
  try {
    const res = await api.get(`/users/${encodeURIComponent(userId)}`);
    // Backend returns { id, name }
    return res.data;
  } catch (err) {
    const status = err?.response?.status;
    if (status === 404) {
      // Not found: return a graceful minimal payload
      return { id: String(userId), name: null };
    }
    // Invalid ID or other failures should be handled by the caller for displaying 'Unknown user'
    throw err;
  }
}
