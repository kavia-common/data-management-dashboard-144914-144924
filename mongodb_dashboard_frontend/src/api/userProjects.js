export async function fetchUserProjectDetails({ baseUrl = '', userId, organization_id, from, to, signal } = {}) {
  // PUBLIC_INTERFACE
  /** Fetch distinct project details for a user.
   * Returns: { userId, projects: [{ project_id, project_name }] }
   */
  if (!userId) throw new Error('userId is required');
  if (!organization_id) throw new Error('organization_id is required');
  const params = new URLSearchParams();
  params.set('organization_id', organization_id);
  if (from) params.set('from', from);
  if (to) params.set('to', to);

  const url = `${baseUrl}/api/users/${encodeURIComponent(userId)}/project-details?${params.toString()}`;
  const res = await fetch(url, { signal });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to load project details (${res.status}): ${text || res.statusText}`);
  }
  return res.json();
}
