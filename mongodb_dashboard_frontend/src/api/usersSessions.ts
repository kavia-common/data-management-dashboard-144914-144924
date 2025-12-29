import axios from 'axios';

const API_BASE = process.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_API_BASE_URL || '';

export type SessionRecord = Record<string, any>;

// PUBLIC_INTERFACE
export async function fetchUserSessions(userId: string, organizationId?: string) {
  /** Fetch session_tracking records for a given userId with optional tenant scope (organization_id). */
  const params: Record<string, string> = {};
  if (organizationId) params.organization_id = organizationId;

  const url = `${API_BASE}/api/users/${encodeURIComponent(userId)}/sessions`;
  const res = await axios.get(url, { params });
  // API may return raw array or { success, data, meta }
  if (Array.isArray(res.data)) return { items: res.data, meta: undefined };
  if (res.data && Array.isArray(res.data.data)) return { items: res.data.data, meta: res.data.meta };
  return { items: [], meta: undefined };
}
