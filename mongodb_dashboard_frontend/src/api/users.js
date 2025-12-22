 import { getApiClient } from './baseClient.js';

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
  * Accepts a params object that can carry tenant scoping, pagination and optional time range:
  * { organization_id?: string, tenant_id?: string, from?: string, to?: string, page?: number, limit?: number }
  * Only one request should be issued per change in these parameters.
  */
 export async function getUserProjects(userId, params = {}, axiosConfig = {}) {
   if (!userId) throw new Error('userId is required');
   const api = getApiClient();
   const { data } = await api.get(
     `/api/users/${encodeURIComponent(userId)}/projects`,
     { ...(axiosConfig || {}), params }
   );
   return data;
 }
