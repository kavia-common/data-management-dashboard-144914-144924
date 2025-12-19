import client from './client';
import { getOrgIdFromContext } from '../utils/orgContext';

/**
 * PUBLIC_INTERFACE
 * fetchProjectsSummary
 * Fetches the projects created summary with tenant scoping.
 * Ensures organization_id is included both as query param and header for consistency with backend behavior.
 * Falls back to provided overrideOrgId if present.
 */
export async function fetchProjectsSummary(params = {}, overrideOrgId) {
  // Resolve effective org id from shared source (context/cookie/header) or override
  const effectiveOrg = (overrideOrgId || getOrgIdFromContext() || '').trim();

  const query = new URLSearchParams();
  // Range and optional custom dates
  if (params.range) query.set('range', params.range);
  if (params.start_date) query.set('start_date', params.start_date);
  if (params.end_date) query.set('end_date', params.end_date);

  // Always include organization_id to be explicit (backend ignores when JWT present)
  if (effectiveOrg) {
    query.set('organization_id', effectiveOrg);
    query.set('tenant_id', effectiveOrg);
  }

  const url = `/api/projects/summary${query.toString() ? `?${query.toString()}` : ''}`;

  const headers = {};
  if (effectiveOrg) {
    headers['x-organization-id'] = effectiveOrg;
  }

  const res = await client.get(url, { headers });
  return {
    data: res?.data || {},
    orgId: effectiveOrg,
    // Echo headers in case callers need debugging
    headers: res?.headers || {},
  };
}
