'use strict';

/**
 * PUBLIC_INTERFACE
 * fetchProjectCreateSummary
 * Minimal client for GET /api/project-create/summary that:
 * - Sends organization_id via x-organization-id header (preferred) or query param fallback.
 * - Accepts range and custom dates, and optional project_id.
 * - Returns JSON { success, buckets, project_id? }.
 * Note: For special tenant 'T0000', the response buckets will be grouped by organization
 *       where bucket.label/key are organization_id and user fields are null.
 */
// PUBLIC_INTERFACE
export async function fetchProjectCreateSummary({
  baseUrl = '',
  organization_id,
  range = 'daily',
  start_date,
  end_date,
  project_id,
  signal,
} = {}) {
  /** This is a public function. */
  if (!baseUrl) baseUrl = '';
  const url = new URL('/api/project-create/summary', baseUrl || window.location.origin);

  if (range) url.searchParams.set('range', String(range));
  if (range === 'custom') {
    if (start_date) url.searchParams.set('start_date', String(start_date));
    if (end_date) url.searchParams.set('end_date', String(end_date));
  }
  if (project_id != null && project_id !== '') {
    url.searchParams.set('project_id', String(project_id));
  }

  const headers = new Headers();
  if (organization_id) {
    // Prefer header, but also add query alias for environments stripping custom headers
    headers.set('x-organization-id', String(organization_id));
    url.searchParams.set('organization_id', String(organization_id));
  }

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers,
    signal,
    credentials: 'include',
  });

  // Preserve existing success path; throw on HTTP errors for upstream UI handling
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`Request failed: ${res.status} ${res.statusText} ${text}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  // UI hint: When organization_id === 'T0000', expect buckets with label/key as org id and user fields null.
  return data;
}
