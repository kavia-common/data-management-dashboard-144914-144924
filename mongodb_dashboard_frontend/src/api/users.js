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
export async function getUserProjects(userId, params = {}) {
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
  });
  return data;
}
