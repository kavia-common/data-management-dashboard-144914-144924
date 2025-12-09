import client from './client';

/**
 * PUBLIC_INTERFACE
 * getUsersSummary
 * 
 * Fetches users summary grouped by created_at buckets from the backend.
 * - Defaults to daily (today) when no arguments provided.
 * - For custom range, requires start_date and end_date in YYYY-MM-DD format.
 * - Organization/Tenant context is derived from the configured client (JWT/header),
 *   do NOT send organization_id/tenant_id in query params.
 *
 * @param {Object} params
 * @param {'daily'|'weekly'|'monthly'|'custom'} [params.range='daily'] - Range granularity
 * @param {string} [params.start_date] - YYYY-MM-DD (required if range === 'custom')
 * @param {string} [params.end_date] - YYYY-MM-DD (required if range === 'custom')
 * @returns {Promise<{ data: any }>} Axios response data
 */
export async function getUsersSummary({ range = 'daily', start_date, end_date } = {}) {
  const params = {};

  if (range) {
    params.range = range;
  }

  if (range === 'custom') {
    if (start_date) params.start_date = start_date;
    if (end_date) params.end_date = end_date;
  }

  // Rely on client interceptors to set auth/tenant context headers.
  const res = await client.get('/api/users/summary', { params });
  return res.data;
}

export default {
  getUsersSummary,
};
