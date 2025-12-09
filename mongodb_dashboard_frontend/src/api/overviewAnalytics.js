import client from './client';

/**
 * PUBLIC_INTERFACE
 * getOverviewTotals
 * Fetch totals for overview dashboard.
 */
export async function getOverviewTotals(params = {}) {
  const res = await client.get('/api/dashboard/overview/metrics', { params });
  return res.data;
}
