import axios from 'axios';
import { setAuthToken, getAuthToken, setTenantId, getTenantId, clearAuth } from '../utils/auth';
import { getApiBaseUrl } from './util';

// Public endpoints that should not include Authorization
const PUBLIC_PATHS = new Set([
  '/health',
  '/api-docs',
  '/swagger',
  '/api/auth/health',
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/reset-password',
]);

function isPublicPath(url) {
  try {
    let path = url || '';
    if (/^https?:\/\//i.test(path)) {
      const u = new URL(path);
      path = u.pathname;
    }
    for (const p of PUBLIC_PATHS) {
      if (path.startsWith(p)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Central Axios instance:
 * - baseURL resolved from util.getApiBaseUrl()
 * - Attaches Authorization: Bearer <token> and x-tenant-id from storage on each request
 * - Response 401/403 -> clear auth and redirect to /login with next param
 */
const httpClient = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: false,
});

httpClient.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    const tenantId = getTenantId();
    const targetUrl = config.baseURL ? `${config.baseURL}${config.url || ''}` : (config.url || '');
    if (!isPublicPath(targetUrl)) {
      config.headers = config.headers || {};
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      if (tenantId && !config.headers['x-tenant-id']) {
        config.headers['x-tenant-id'] = tenantId;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

httpClient.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    if (status === 401 || status === 403) {
      try {
        clearAuth();
        if (typeof window !== 'undefined') {
          const current = window.location.pathname + window.location.search + window.location.hash;
          if (window.location.pathname !== '/login') {
            window.location.replace(`/login?next=${encodeURIComponent(current)}`);
          }
        }
      } catch {
        // ignore
      }
    }
    return Promise.reject(error);
  }
);

/**
 * PUBLIC_INTERFACE
 * storeAuthFromResponse
 * Persist only id_token for Authorization usage; also persist tenant_id.
 */
export function storeAuthFromResponse(data) {
  /** Stores id_token and tenant if present in response payload. */
  const idToken = data?.id_token || data?.token || null;
  if (idToken) setAuthToken(idToken);
  if (data?.tenant_id) setTenantId(data.tenant_id);
}

export default httpClient;
