import requestClient from './requestClient';

/**
 * PUBLIC_INTERFACE
 * fetchUserProjects
 * Fetches the list of projects associated with a user for a given tenant and optional time range.
 * This function is designed to leverage the existing requestClient caching/deduplication.
 *
 * Parameters:
 * - userId: string (required) - The user identifier
 * - organization_id: string (required) - The tenant/organization id (alias: tenant_id)
 * - options: {
 *     from?: string (ISO datetime),
 *     to?: string (ISO datetime),
 *     enabled?: boolean (default true) - if false, this call is a no-op and returns undefined (no request)
 *   }
 *
 * Returns:
 * - Promise resolving to the server response payload when enabled is true.
 * - undefined immediately when enabled is false (no network call).
 *
 * Notes:
 * - Uses a composite cache key: ['user-projects', userId, organization_id, from||'', to||'']
 * - Only fires when enabled === true to support on-demand/modal-open fetching.
 */
// PUBLIC_INTERFACE
export async function fetchUserProjects(userId, organization_id, options = {}) {
  /** Fetch user projects with requestClient caching and conditional execution. */
  const { from, to, enabled = true } = options || {};
  if (!enabled) {
    // Respect the on-demand requirement; do not fire request if not enabled
    return undefined;
  }
  if (!userId || !organization_id) {
    throw new Error('fetchUserProjects: userId and organization_id are required');
  }

  const params = {
    organization_id,
  };
  if (from) params.from = from;
  if (to) params.to = to;

  // Build composite cache key to reuse requestClient's internal cache/dedup
  const cacheKey = ['user-projects', String(userId), String(organization_id), from || '', to || ''];

  return requestClient.get(`/api/users/${encodeURIComponent(userId)}/projects`, {
    params,
    cacheKey,
  });
}

export default {
  fetchUserProjects,
};
