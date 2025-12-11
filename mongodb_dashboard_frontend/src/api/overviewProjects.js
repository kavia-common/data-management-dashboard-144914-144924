import { getApiBaseUrl } from './modulesClient';

/**
// PUBLIC_INTERFACE
 * getOverviewProjects
 * Fetches aggregated "Total Projects" over time with filters.
 * params: { timeframe: 'daily'|'weekly'|'monthly'|'custom', start_date?, end_date? }
 */
export async function getOverviewProjects(params = {}) {
  const base = getApiBaseUrl();
  const url = new URL('/api/overview/projects', base);
  const q = new URLSearchParams();

  const timeframe = String(params.timeframe || params.range || 'daily').toLowerCase();
  q.set('timeframe', timeframe);
  if (timeframe === 'custom') {
    if (params.start_date) q.set('start_date', params.start_date);
    if (params.end_date) q.set('end_date', params.end_date);
  }

  url.search = q.toString();

  const resp = await fetch(url.toString(), {
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Failed to fetch overview projects: ${resp.status} ${txt}`);
  }
  return resp.json();
}
