import { getApiBase } from './utilBase';

/**
 * PUBLIC_INTERFACE
 * getOverviewAnalytics
 * Fetches overview analytics using metric and range parameters.
 * Builds URL based on configured API base, ensuring proper /api prefix and query string.
 */
export async function getOverviewAnalytics({ metric = 'creates', range = '30d' } = {}) {
  // Build query string
  const params = new URLSearchParams({ metric, range }).toString();

  // Normalize base and root
  const base = String(getApiBase() || '').replace(/\/+$/, '');
  const root = base.endsWith('/api') ? base.slice(0, -4) : base;

  const url = `${root}/api/analytics/overview${params ? `?${params}` : ''}`;
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Failed to fetch overview analytics (${res.status})`);
  }
  return res.json();
}

export default { getOverviewAnalytics };
