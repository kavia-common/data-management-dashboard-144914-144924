import client from './client';

/**
 * Resolve projectName for a given projectId using the App Deployments resolver endpoint.
 * Falls back to projectId if name is not available.
 * @param {string} projectId
 * @returns {Promise<string|null>}
 */
async function resolveProjectName(projectId) {
  if (!projectId) return null;
  try {
    const res = await client.get(`/api/app-deployments/project/${encodeURIComponent(projectId)}/name`);
    if (res?.data && typeof res.data === 'object') {
      const { projectName } = res.data;
      return projectName ?? projectId;
    }
  } catch (e) {
    // Soft-fail to keep UI responsive; return projectId if resolution API fails.
    // console.debug('resolveProjectName failed', e);
  }
  return projectId;
}

/**
 * Fetch a user's projects (distinct) from session tracking via backend Users endpoint.
 * Ensures organization scope is provided using current config/tenant.
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.organizationId - tenant/organization id
 * @param {string} [params.from] - ISO datetime
 * @param {string} [params.to] - ISO datetime
 * @returns {Promise<{ user_id: string, tenant_id: string, projects: Array<{project_id: string, project_name: string|null, last_activity?: string|null}> }>}
 */
export async function fetchUserProjects({ userId, organizationId, from, to }) {
  if (!userId) throw new Error('userId is required');
  if (!organizationId) throw new Error('organizationId is required');

  const params = new URLSearchParams();
  params.set('organization_id', organizationId);
  if (from) params.set('from', from);
  if (to) params.set('to', to);

  const url = `/api/users/${encodeURIComponent(userId)}/projects?${params.toString()}`;
  const res = await client.get(url);
  return res.data;
}

// PUBLIC_INTERFACE
export async function getUserProjectsWithNames({ userId, organizationId, from, to }) {
  /** Fetches user's distinct projects and resolves each project's friendly name. */
  const raw = await fetchUserProjects({ userId, organizationId, from, to });
  const projects = Array.isArray(raw?.projects) ? raw.projects : [];

  // Resolve names in parallel with a small cap to avoid flooding
  const concurrency = 6;
  const queue = [...projects];
  const results = [];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }).map(async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      const name = await resolveProjectName(item.project_id);
      results.push({ ...item, project_name: name });
    }
  });
  await Promise.all(workers);

  // Maintain stable order by project_id asc
  results.sort((a, b) => String(a.project_id).localeCompare(String(b.project_id)));

  return {
    user_id: raw?.user_id ?? userId,
    tenant_id: raw?.tenant_id ?? organizationId,
    projects: results,
  };
}

export default {
  fetchUserProjects,
  getUserProjectsWithNames,
};
