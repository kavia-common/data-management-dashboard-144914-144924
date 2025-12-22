'use strict';

/**
 * PUBLIC_INTERFACE
 * fetchProjectCreateSummary
 * Client for GET /api/project-create/summary:
 * - Sends organization_id via x-organization-id header and as query param.
 * - Accepts range, custom dates, optional project_id.
 * - Supports AbortController via signal param.
 * - Returns parsed JSON.
 */
// PUBLIC_INTERFACE
export async function fetchProjectCreateSummary({
  organization_id,
  range = 'daily',
  start_date,
  end_date,
  project_id,
  signal,
} = {}) {
  // Build base URL via env with fallback to location.origin
  const base =
    (process?.env?.REACT_APP_API_BASE_URL || '') +
    (process?.env?.REACT_APP_API_PREFIX || '/api');
  const url = new URL('/project-create/summary', base || window.location.origin);

  if (range) url.searchParams.set('range', String(range));
  if (range === 'custom') {
    if (start_date) url.searchParams.set('start_date', String(start_date));
    if (end_date) url.searchParams.set('end_date', String(end_date));
  }
  if (project_id != null && project_id !== '') {
    url.searchParams.set('project_id', String(project_id));
  }
  if (organization_id) {
    url.searchParams.set('organization_id', String(organization_id));
  }

  const headers = new Headers();
  if (organization_id) {
    headers.set('x-organization-id', String(organization_id));
  }

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers,
    signal,
    credentials: 'include',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`Request failed: ${res.status} ${res.statusText} ${text}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}
