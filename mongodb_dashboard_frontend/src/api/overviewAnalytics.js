import client from './client';

/**
 * PUBLIC_INTERFACE
 * getOverviewTotals
 * Fetch totals for overview dashboard.
 * The legacy backend endpoint was removed; this function now attempts the documented
 * path and gracefully falls back to a no-op object to avoid runtime errors in Overview.
 */
export async function getOverviewTotals(params = {}) {
  try {
    const res = await client.get('/api/dashboard/overview/metrics', { params });
    return res.data;
  } catch (e) {
    // Fallback: prevent runtime errors; return minimal structure for UI rendering
    return { success: false, note: 'Overview metrics endpoint removed', totalUsers: 0, totalDeployedApps: 0 };
  }
}
