import client from './client';
import modulesClient from './modulesClient';

/**
 * PUBLIC_INTERFACE
 * Fetch total LLM costs for a specific user within tenant scope.
 * 
 * @param {Object} params - Query parameters
 * @param {string} params.user_id - The clicked user's id
 * @param {string} [params.organization_id] - Tenant/organization scope, omitted for super admin/global
 * @param {Object} [options] - Additional request options, forwarded to client
 * @returns {Promise<{ totalCost: number, currency?: string, raw: any }>} Normalized total cost result
 */
export async function getUserTotalCost(params = {}, options = {}) {
  const { user_id, organization_id, ...rest } = params || {};
  if (!user_id) {
    throw new Error('getUserTotalCost: user_id is required');
  }

  // Build query params, include organization_id only if provided (non-empty)
  const query = new URLSearchParams({ user_id, ...rest });
  if (organization_id) {
    query.set('organization_id', organization_id);
  }

  // Prefer modulesClient if available for module-routed APIs; fallback to base client
  const http = modulesClient || client;

  const response = await http.get(`/api/costs/user/total?${query.toString()}`, options);

  // Depending on API client shape, data can be at response.data or response
  const payload = response?.data ?? response;

  // Backend schema: { success, data: { total_cost, currency, by_agent, ... }, meta: { ... } }
  // Normalize to { totalCost, currency, raw }
  const totalCost =
    payload?.data?.total_cost ??
    payload?.totalCost ??
    payload?.data?.totalCost ??
    0;

  const currency =
    payload?.data?.currency ??
    payload?.currency ??
    'USD';

  return {
    totalCost: Number(totalCost) || 0,
    currency,
    raw: payload,
  };
}

export default {
  getUserTotalCost,
};
