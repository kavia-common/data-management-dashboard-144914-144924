import { getApiBaseUrl } from './config';
import { tenantHeaders } from './util';

/**
 * PUBLIC_INTERFACE
 * fetchOverviewTotals
 * Fetches overview total metrics for KPIs. Sends tenant scope in both query and header.
 * Includes minimal console.debug logs and tolerates variant/empty payloads.
 *
 * @param {Object} options
 * @param {string} options.organizationId - tenant id, required in demo/no-JWT mode
 * @param {AbortSignal} [options.signal] - optional abort signal, should only abort on unmount
 * @returns {Promise<{ totalUsers: number, totalDeployedApps: number }>}
 */
export async function fetchOverviewTotals({ organizationId, signal } = {}) {
  const baseUrl = getApiBaseUrl();
  const params = new URLSearchParams();

  // Even if backend may ignore with JWT, include both query param and header for demo mode.
  if (organizationId) {
    params.set('organization_id', organizationId);
  }

  const url = `${baseUrl}/api/dashboard/overview/metrics?${params.toString()}`;

  const headers = {
    'Content-Type': 'application/json',
    ...(organizationId ? { 'x-organization-id': organizationId } : {}),
    ...tenantHeaders(organizationId),
  };

  const debugPrefix = '[overviewKPIs]';
  console.debug(`${debugPrefix} fetch start`, { url, organizationId });

  const res = await fetch(url, { headers, signal });

  const text = await res.text(); // tolerate non-JSON error bodies
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch (e) {
    // keep payload as {}
  }

  console.debug(`${debugPrefix} fetch end`, {
    ok: res.ok,
    status: res.status,
    payloadType: typeof payload,
    responseSize: text?.length ?? 0,
  });

  // Tolerate shapes: {success, totalUsers, totalDeployedApps} or array/envelope fallbacks
  const safeNumber = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

  const totalUsers = safeNumber(
    payload?.totalUsers ??
      payload?.data?.totalUsers ??
      payload?.meta?.totalUsers ??
      payload?.counts?.users ??
      0
  );
  const totalDeployedApps = safeNumber(
    payload?.totalDeployedApps ??
      payload?.data?.totalDeployedApps ??
      payload?.meta?.totalDeployedApps ??
      payload?.counts?.deployments ??
      0
  );

  return { totalUsers, totalDeployedApps };
}

/**
 * PUBLIC_INTERFACE
 * adaptOverviewTotalsToKpis
 * Adapts raw totals to a fixed KPI tile shape.
 *
 * @param {{ totalUsers: number, totalDeployedApps: number }} totals
 * @returns {Array<{ label: string, value: number, delta?: number }>}
 */
export function adaptOverviewTotalsToKpis(totals) {
  const { totalUsers = 0, totalDeployedApps = 0 } = totals || {};
  return [
    { label: 'Total Users', value: Number.isFinite(totalUsers) ? totalUsers : 0 },
    { label: 'Deployed Apps', value: Number.isFinite(totalDeployedApps) ? totalDeployedApps : 0 },
  ];
}
