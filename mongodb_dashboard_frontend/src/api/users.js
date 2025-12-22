import { getApiClient } from './baseClient';

/**
 * PUBLIC_INTERFACE
 * getUserBasic
 * Fetch a single user document by id from /api/users/{id}.
 * Returns the raw user document payload as { ... }.
 */
export async function getUserBasic(userId, params = {}) {
  if (!userId) throw new Error('userId is required');
  const api = getApiClient();
  const { data } = await api.get(`/api/users/${encodeURIComponent(String(userId))}`, { params });
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
  const { data } = await api.get(`/api/users/${encodeURIComponent(String(userId))}/projects`, { params });
  return data;
}
