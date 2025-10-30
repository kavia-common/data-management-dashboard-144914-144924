/**
 * Determine API base URL with environment override and safe fallback.
 * Priority:
 *  - REACT_APP_API_BASE_URL (should include protocol and optional /api)
 *  - window location host at :3001 with /api suffix
 */
function computeApiBase() {
  const envBase = process.env.REACT_APP_API_BASE_URL;
  if (envBase && typeof envBase === 'string' && envBase.trim()) {
    // Ensure no trailing slash duplication; allow both with and without /api
    return envBase.trim().replace(/\/+$/, '');
  }
  const host = `${window.location.protocol}//${window.location.hostname}:3001`;
  return `${host}/api`;
}

// Cache on module load
const API_BASE = computeApiBase();

/**
 * PUBLIC_INTERFACE
 * getApiBase
 * Returns the base URL for backend API requests.
 */
export function getApiBase() {
  return API_BASE;
}

export default { getApiBase };
