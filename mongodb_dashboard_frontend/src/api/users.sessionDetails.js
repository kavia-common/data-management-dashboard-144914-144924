import { getApiClient } from './baseClient';

/**
 * PUBLIC_INTERFACE
 * fetchUserSessionDetails
 * Calls POST /api/users/session-details with JSON body: { user_id, tenant_id?, from?, to?, page?, limit?, sort? }
 * Returns the response payload as-is: { user_id, tenant_id, sessions: [...], meta: {...} }
 */
export async function fetchUserSessionDetails({ userId, tenantId, from, to, page, limit, sort } = {}) {
  if (!userId) {
    throw new Error('userId is required');
  }
  const api = getApiClient();
  const body = {
    user_id: String(userId),
    ...(tenantId ? { tenant_id: String(tenantId) } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(page ? { page } : {}),
    ...(limit ? { limit } : {}),
    ...(sort ? { sort } : {}),
  };
  const { data } = await api.post('/api/users/session-details', body, { params: {} });
  return data;
}
