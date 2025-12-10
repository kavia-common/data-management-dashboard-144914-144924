/* eslint-disable no-console */
import axios from 'axios';

// PUBLIC_INTERFACE
export function setAuthContext({ token, tenant_id }) {
  /**
   * Store the auth context in localStorage.
   * token: ID token (JWT)
   * tenant_id: active tenant id
   */
  const ctx = { token: token || null, tenant_id: tenant_id || null };
  localStorage.setItem('authContext', JSON.stringify(ctx));
}

// PUBLIC_INTERFACE
export function getAuthContext() {
  /**
   * Retrieve the auth context from localStorage.
   * Returns { token, tenant_id } or { token:null, tenant_id:null } if missing.
   */
  try {
    const raw = localStorage.getItem('authContext');
    if (!raw) return { token: null, tenant_id: null };
    const parsed = JSON.parse(raw);
    return { token: parsed?.token || null, tenant_id: parsed?.tenant_id || null };
  } catch {
    return { token: null, tenant_id: null };
  }
}

function resolveBaseUrl() {
  try {
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      return `${window.location.origin.replace(/\/+$/, '')}/api`;
    }
  } catch {
    // ignore
  }
  const envBase = (process && process.env && process.env.REACT_APP_API_BASE_URL) || '';
  if (envBase) {
    const trimmed = String(envBase).replace(/\/+$/, '');
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
  }
  return '/api';
}

/**
 * Axios instance that automatically attaches Authorization and x-tenant-id headers.
 * Also logs missing headers and the final resolved URL in development to aid diagnostics.
 */
const axiosInstance = axios.create({
  baseURL: resolveBaseUrl(),
  withCredentials: false,
});

axiosInstance.interceptors.request.use((config) => {
  const cfg = { ...config };
  const { token, tenant_id } = getAuthContext();
  cfg.headers = cfg.headers || {};
  if (token && !cfg.headers.Authorization) {
    cfg.headers.Authorization = `Bearer ${token}`;
  }
  if (tenant_id && !cfg.headers['x-tenant-id']) {
    cfg.headers['x-tenant-id'] = tenant_id;
  }

  if (process.env.NODE_ENV !== 'production') {
    const method = cfg.method?.toUpperCase?.() || 'GET';
    const base = cfg.baseURL || '';
    const path = cfg.url || '';
    const finalUrl = `${String(base).replace(/\/+$/, '')}/${String(path).replace(/^\/+/, '')}`;
    console.debug(`[api-client] ${method} ${finalUrl} auth=${!!cfg.headers.Authorization} x-tenant-id=${cfg.headers['x-tenant-id'] || 'n/a'}`);
  }

  return cfg;
});

export default axiosInstance;
