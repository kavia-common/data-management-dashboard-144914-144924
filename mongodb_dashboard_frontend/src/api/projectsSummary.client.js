import client from './client';
import { getOrgIdFromContext } from '../utils/orgContext';

/**
 * PUBLIC_INTERFACE
 * fetchProjectsSummary
 * Fetch projects created summary with enforced tenant propagation and minimal logging.
 * - Always include organization_id in query and x-organization-id header (when available).
 * - This function does not use AbortController directly; the calling hook manages lifecycle.
 * - Returns the raw API payload so adapters/hooks can shape as needed.
 */
// PUBLIC_INTERFACE
export async function fetchProjectsSummary(params = {}, overrideOrgId) {
  const {
    range,
    start_date,
    end_date,
    project_id,
    organization_id,
    tenant_id,
    ...rest
  } = params || {};

  // Resolve effective org id from shared context or overrides
  const effectiveOrg = (overrideOrgId || organization_id || tenant_id || getOrgIdFromContext() || '').trim();

  const query = new URLSearchParams();
  if (range) query.set('range', range);
  if (start_date) query.set('start_date', start_date);
  if (end_date) query.set('end_date', end_date);
  if (project_id) query.set('project_id', project_id);
  // Always pass org in query when available
  if (effectiveOrg) {
    query.set('organization_id', effectiveOrg);
    query.set('tenant_id', effectiveOrg);
  }
  // include any remaining scalar params
  Object.entries(rest || {}).forEach(([k, v]) => {
    if (v == null) return;
    if (typeof v === 'object') return; // avoid complex nesting in query
    query.set(k, String(v));
  });

  const headers = {};
  if (effectiveOrg) {
    headers['x-organization-id'] = effectiveOrg;
  }

  const url = `/api/projects/summary${query.toString() ? `?${query.toString()}` : ''}`;

  try {
    if (process.env.NODE_ENV !== 'test') {
      // eslint-disable-next-line no-console
      console.log('[projectsSummary] fetch start', { url, headers });
    }
    const res = await client.get(url, { headers });
    if (process.env.NODE_ENV !== 'test') {
      // eslint-disable-next-line no-console
      console.log('[projectsSummary] fetch end', { status: res?.status });
    }
    return res?.data ?? {};
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      // eslint-disable-next-line no-console
      console.log('[projectsSummary] fetch error', err?.message || err);
    }
    throw err;
  }
}
