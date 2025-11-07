import httpClient from './httpClient';
import { getApiBaseUrl } from './util';

// PUBLIC_INTERFACE
export function getApiClient() {
  /** Returns the shared axios client with JWT/tenant interceptors. */
  return httpClient;
}

// PUBLIC_INTERFACE
export async function health() {
  /** Hit auth health endpoint without requiring Authorization header. */
  const base = getApiBaseUrl();
  const root = String(base).replace(/\/api$/, '');
  try {
    const res = await fetch(`${root}/`, { headers: { Accept: 'application/json' } });
    if (res.ok) return res.json();
  } catch {
    // ignore
  }
  const res2 = await fetch(`${root}/api/auth/health`, { headers: { Accept: 'application/json' } });
  if (!res2.ok) return {};
  return res2.json();
}

// PUBLIC_INTERFACE
export async function listUsers(params = {}) {
  const res = await httpClient.get('/api/users', { params });
  return res.data;
}

// PUBLIC_INTERFACE
export async function listSessions(params = {}) {
  const res = await httpClient.get('/api/session-tracking', { params });
  return res.data;
}

// PUBLIC_INTERFACE
export async function listDeployments(params = {}) {
  const res = await httpClient.get('/api/app-deployments', { params });
  return res.data;
}

// PUBLIC_INTERFACE
export async function listLlmCosts(params = {}) {
  const res = await httpClient.get('/api/llm-costs', { params });
  return res.data;
}

export default {
  getApiClient,
  listUsers,
  listSessions,
  listDeployments,
  listLlmCosts,
  health,
};
