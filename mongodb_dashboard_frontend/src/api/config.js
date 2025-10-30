/**
 * Compute API base URL once, ensuring exactly one '/api' suffix.
 */
function computeApiBase() {
  const envBase = (process.env.REACT_APP_API_BASE_URL || '').trim();
  const prefix = '/api';

  const ensureNoTrailingSlash = (s) => s.replace(/\/+$/, '');
  const ensureLeadingSlash = (s) => (s.startsWith('/') ? s : `/${s}`);

  if (envBase) {
    const trimmed = ensureNoTrailingSlash(envBase);
    return /\/api$/.test(trimmed) ? trimmed : `${trimmed}${prefix}`;
  }

  try {
    const { protocol, hostname, port } = window.location;
    let p = port;
    // In CRA dev, backend usually runs on 3001 when frontend is 3000
    if (!p && protocol === 'http:') p = '80';
    if (!p && protocol === 'https:') p = '443';
    let targetPort = p;
    if (p === '3000') targetPort = '3001';
    const origin = `${protocol}//${hostname}${targetPort ? `:${targetPort}` : ''}`;
    return `${origin}${prefix}`;
  } catch {
    return 'http://localhost:3001/api';
  }
}

const apiBase = computeApiBase();

/**
 * PUBLIC_INTERFACE
 * getApiBase
 * Returns the base URL for backend API requests, preferring REACT_APP_API_BASE_URL
 * and falling back to current host with port 3001.
 */
export function getApiBase() {
  return apiBase;
}

export default { getApiBase };
