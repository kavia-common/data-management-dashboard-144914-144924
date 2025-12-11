/**
 * Resolve project name via dedicated endpoint.
 * Uses GET /api/app-deployments/project/{projectId}/name which returns { projectId, projectName } with 200.
 * Always prefers the shared axios client (with interceptors). If an HTTP fallback is needed,
 * include Authorization and x-tenant-id headers via buildAuthHeaders and stored tenant id.
 */

import axios from 'axios';
import { getApiBaseUrl } from './util';
import { getApiClient } from './index';
import { buildAuthHeaders, getTenantId, getOrganizationId } from './authTokenProvider';

/**
 * PUBLIC_INTERFACE
 */
// PUBLIC_INTERFACE
export async function fetchProjectNameDirect(projectId) {
  /** Returns the project's friendly name or null if not found/failed. */
  if (!projectId) return null;

  try {
    const path = `/app-deployments/project/${encodeURIComponent(String(projectId))}/name`;
    const api = typeof getApiClient === 'function' ? getApiClient() : null;

    // Prefer shared axios client with interceptors (adds Authorization and x-tenant-id)
    if (api) {
      const res = await api.get(path);
      const data = res?.data || {};
      if (typeof data?.projectName === 'undefined') {
        console.debug('[ProjectName] Missing projectName in response (api client path)', { projectId, data });
      }
      return data?.projectName ?? null;
    }

    // Fallback to base URL + axios, but include Authorization and x-tenant-id headers
    const base = (typeof getApiBaseUrl === 'function' && getApiBaseUrl()) || '/api';
    const url = `${String(base).replace(/\/$/, '')}${path}`;

    // Build headers with Authorization and x-tenant-id when available
    const tenant = getTenantId?.() || getOrganizationId?.() || null;
    const headers = buildAuthHeaders({
      ...(tenant ? { 'x-tenant-id': tenant } : {}),
    });

    const res = await axios.get(url, { headers });
    const data = res?.data || {};
    if (typeof data?.projectName === 'undefined') {
      console.debug('[ProjectName] Missing projectName in response (fallback path)', { projectId, data });
    }
    return data?.projectName ?? null;
  } catch (e) {
    // API guarantees 200 with null when not found, but still guard.
    const status = e?.response?.status;
    if (status === 404) {
      console.debug('[ProjectName] 404 when fetching project name', { projectId });
      return null;
    }
    console.error('[ProjectName] Failed to fetch project name', { projectId, error: e?.message || e });
    return null;
  }
}

/**
 * Deprecated alias retained for compatibility.
 */
// PUBLIC_INTERFACE
export async function fetchProjectNameByProjectId(projectId) {
  /** Returns the project's friendly name or null if not found/failed. */
  return fetchProjectNameDirect(projectId);
}
