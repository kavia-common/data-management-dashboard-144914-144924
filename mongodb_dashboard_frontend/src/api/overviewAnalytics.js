import client from './client';

/**
 * PUBLIC_INTERFACE
 * getOverviewTotals
 * Fetch totals for overview dashboard: { success, totalUsers, totalDeployedApps, totalSessions? }
 * Inline: keeps API surface minimal for KPI cards.
 */
export async function getOverviewTotals(params = {}) {
  const res = await client.get('/api/dashboard/overview/metrics', { params });
  // Some backends may not include totalSessions; normalize here
  const data = res?.data ?? {};
  return {
    ...data,
    totalUsers: Number(data?.totalUsers ?? data?.users ?? 0),
    totalDeployedApps: Number(data?.totalDeployedApps ?? data?.projects ?? data?.deployments ?? 0),
    ...(data?.totalSessions !== undefined ? { totalSessions: Number(data.totalSessions) } : {}),
  };
}
