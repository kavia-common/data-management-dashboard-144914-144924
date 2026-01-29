import { buildAuthHeaders, getOrganizationId } from '../api/authTokenProvider';
import { apiBase as configuredApiBase } from '../api/config';

/**
 * PUBLIC_INTERFACE
 * apiGet (JS wrapper)
 * Centralized GET helper that automatically injects Authorization, resolves the correct baseURL with /api
 * using centralized config (src/api/config.js), appends organization_id when available
 * (without duplicating), and logs the final resolved URL.
 */
function isAbsoluteUrl(url) {
  return /^https?:\/\//i.test(url);
}

function getBaseApiUrl() {
  // Prefer centralized configured base from src/api/config.js
  let base = String(configuredApiBase || '').replace(/\/+$/, '');
  if (base) {
    // Ensure it ends with /api
    if (!/\/api$/.test(base)) {
      base = `${base}/api`;
    }
    return base;
  }

  // Fallback: REACT_APP_API_BASE_URL if provided (kept for safety in edge cases)
  const fromEnv =
    (typeof process !== 'undefined' &&
      process.env &&
      process.env.REACT_APP_API_BASE_URL) ||
    '';
  if (fromEnv) {
    const trimmed = String(fromEnv).replace(/\/+$/, '');
    if (trimmed.endsWith('/api')) return trimmed;
    return `${trimmed}/api`;
  }

  // Last resort: relative '/api'
  return '/api';
}

function joinUrl(base, path) {
  const b = String(base || '').replace(/\/+$/, '');
  if (!path) return b;
  const p = String(path);
  if (isAbsoluteUrl(p)) return p;
  if (p.startsWith('/api')) {
    // If path already includes /api, join with origin root
    // e.g., base=https://host/api -> originRoot=https://host
    const originRoot = b.endsWith('/api') ? b.replace(/\/api$/, '') : b;
    return `${originRoot}${p}`;
  }
  // Normal relative join under base (which ends with /api)
  const rel = p.startsWith('/') ? p : `/${p}`;
  return `${b}${rel}`;
}

function ensureOrgIdInUrl(url, explicitOrgId) {
  const orgId = explicitOrgId || getOrganizationId();
  if (!orgId) return url;
  if (/[?&](organization_id|tenant_id)=/.test(url)) {
    // do not duplicate if either alias is already present
    return url;
  }
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}organization_id=${encodeURIComponent(orgId)}`;
}

// PUBLIC_INTERFACE
export async function apiGet(pathOrUrl, options = {}) {
  const base = getBaseApiUrl();

  // Build the effective URL with correct /api handling
  let url = isAbsoluteUrl(pathOrUrl)
    ? pathOrUrl
    : pathOrUrl && pathOrUrl.startsWith('/api')
    ? joinUrl(base, pathOrUrl) // path contains /api -> join against backend root
    : joinUrl(base, pathOrUrl); // relative path

  // Append organization_id if available and not already provided
  url = ensureOrgIdInUrl(url, options.organization_id);

  const headers = buildAuthHeaders({
    Accept: 'application/json',
    ...(options.headers || {}),
  });

  // Log the final resolved URL for troubleshooting
  // eslint-disable-next-line no-console
  console.log('[utils/api] GET resolved URL:', url);

  const res = await fetch(url, {
    method: 'GET',
    headers,
    signal: options.signal,
    // Default remains omit for backward compatibility, but allow opting-in to cookie-based sessions.
    credentials: options.credentials || 'omit',
  });

  let payload = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      payload = await res.json();
    } catch {
      payload = null;
    }
  } else {
    try {
      payload = await res.text();
    } catch {
      payload = null;
    }
  }

  if (!res.ok) {
    const message =
      (payload && typeof payload === 'object' && (payload.message || payload.detail)) ||
      (typeof payload === 'string' ? payload : `Request failed (${res.status})`);
    const err = new Error(message);
    err.status = res.status;
    err.payload = payload;
    throw err;
  }

  return payload;
}

export default { apiGet };
