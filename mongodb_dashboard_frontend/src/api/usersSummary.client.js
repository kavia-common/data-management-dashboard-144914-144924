import { getApiBase } from './config';
import clientDefault from './client';

/**
 * PUBLIC_INTERFACE
 * fetchUsersSummary
 * Fetches /api/users/summary with range and optional custom date window using the shared axios client.
 * Params: { organization_id?, tenant_id?, range='daily'|'weekly'|'monthly'|'custom', start_date?, end_date?, headers? }
 * Returns: { buckets: [{ label, key?, start?, end?, count }], range, start_date, end_date }
 *
 * Note:
 * - Preserves existing API shape and compatibility with hooks/components.
 * - Sends tenant header x-organization-id when organization_id is provided.
 */
export async function fetchUsersSummary({
  organization_id,
  tenant_id,
  range = 'daily',
  start_date,
  end_date,
  headers: extraHeaders = {},
} = {}) {
  // Use the shared axios client. clientDefault is pre-configured with baseURL from getApiBase()
  // but we still call getApiBase() to ensure the module is initialized (and future-proof).
  const baseUrl = getApiBase(); // eslint-disable-line no-unused-vars
  const client = clientDefault;

  const params = {
    range,
    ...(organization_id ? { organization_id } : {}),
    // Respect alias for tenant
    ...(!organization_id && tenant_id ? { tenant_id } : {}),
    ...(range === 'custom' && start_date ? { start_date } : {}),
    ...(range === 'custom' && end_date ? { end_date } : {}),
  };

  // Maintain current behavior: include x-organization-id header when provided
  const headers = {
    ...(organization_id ? { 'x-organization-id': organization_id } : {}),
    ...extraHeaders,
    'content-type': 'application/json',
  };

  // eslint-disable-next-line no-console
  console.debug('[fetchUsersSummary] GET /api/users/summary', { params });

  const response = await client.get('/users/summary', {
    params,
    headers,
  });

  // eslint-disable-next-line no-console
  console.debug('[fetchUsersSummary] response keys', response?.data && Object.keys(response.data || {}));

  return response.data;
}
