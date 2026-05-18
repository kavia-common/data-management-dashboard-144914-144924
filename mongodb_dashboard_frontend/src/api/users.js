import { getApiClient } from './baseClient';

/**
 * PUBLIC_INTERFACE
 * wrapIsoAsMongoISODate
 * Wraps an ISO string into a Mongo-shell style ISODate("...") expression.
 * This is used for endpoints that expect ISODate-wrapped timestamps in query params.
 *
 * If the value is falsy, returns it unchanged.
 * If the value already starts with ISODate(, returns it unchanged.
 *
 * @param {string | undefined | null} iso
 * @returns {string | undefined | null}
 */
export function wrapIsoAsMongoISODate(iso) {
  if (!iso) return iso;
  const asString = String(iso);
  if (asString.startsWith('ISODate(')) return asString;
  return `ISODate("${asString}")`;
}

/**
 * PUBLIC_INTERFACE
 * getUserBasic
 * Fetch a single user document by id from /api/users/{id}.
 * Returns the raw user document payload as { ... }.
 */
export async function getUserBasic(userId, params = {}) {
  if (!userId) throw new Error('userId is required');
  const api = getApiClient();
  const { data } = await api.get(`/api/users/${encodeURIComponent(userId)}`, { params });
  return data;
}

/**
 * PUBLIC_INTERFACE
 * getUserProjects
 * Fetch distinct projects for a given user from session tracking aggregation.
 * Accepts a params object that can carry tenant scoping and optional time range:
 * { organization_id?: string, tenant_id?: string, from?: string, to?: string }
 */
export async function getUserProjects(userId, params = {}, options = {}) {
  if (!userId) throw new Error('userId is required');
  const api = getApiClient();

  // Ensure from/to are sent using Mongo-style ISODate("...") wrapper as required by this endpoint.
  const formattedParams = {
    ...params,
    from: wrapIsoAsMongoISODate(params?.from),
    to: wrapIsoAsMongoISODate(params?.to),
  };

  const { data } = await api.get(`/api/users/${encodeURIComponent(userId)}/projects`, {
    params: formattedParams,
    signal: options?.signal,
  });
  return data;
}

/**
 * PUBLIC_INTERFACE
 * getUsersProjectsBatch
 * Fetch distinct projects for multiple users in a single request.
 *
 * Backend endpoint:
 *   POST /api/users/projects
 *
 * Body:
 *   {
 *     userIds: string[],
 *     organization_id?: string,
 *     tenant_id?: string,
 *     from?: string (ISO date-time),
 *     to?: string (ISO date-time)
 *   }
 *
 * Response:
 *   {
 *     success: true,
 *     tenant_id: string,
 *     data: Record<string, Array<{project_id, project_name, last_activity}>>
 *   }
 *
 * Note:
 * - This endpoint expects plain ISO strings for from/to (not ISODate("...")).
 */
export async function getUsersProjectsBatch(body = {}, options = {}) {
  const api = getApiClient();

  const userIds = Array.isArray(body?.userIds) ? body.userIds.map(String) : [];
  const payload = {
    ...body,
    userIds,
  };

  const { data } = await api.post('/api/users/projects', payload, { signal: options?.signal });
  return data;
}

/**
 * PUBLIC_INTERFACE
 * getUserSessionDetails
 * Fetch aggregated session details for a given user.
 *
 * Backend endpoint:
 *   GET /api/users/:userId/session-details
 *
 * Expected response fields (used by UI):
 *   - total_count: number
 *   - total_duration: string|number
 *
 * @param {string} userId
 * @param {Object} [params] optional query params
 * @returns {Promise<any>}
 */
export async function getUserSessionDetails(userId, params = {}) {
  if (!userId) throw new Error('userId is required');
  const api = getApiClient();
  const { data } = await api.get(
    `/api/users/${encodeURIComponent(userId)}/session-details`,
    { params }
  );
  return data;
}
