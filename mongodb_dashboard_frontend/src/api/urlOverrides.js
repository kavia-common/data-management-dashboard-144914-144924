/**
 * URL override helper for specific endpoints.
 * We special-case only selected auth endpoints to always call the external domain.
 * As of now, these are:
 *   - /api/auth/user-organizations
 *   - /api/auth/login
 * All other endpoints should continue to use existing base URL logic.
 *
 * To add more overrides later:
 *   - Add a new RegExp to the OVERRIDES list below that uniquely matches the path to be forced external.
 *   - Keep patterns specific to avoid accidental routing changes.
 */
export function resolveAuthEndpointUrl(path, baseUrl) {
  /**
   * Resolve a full URL for auth endpoints.
   * Special-cased to force the absolute external domain for:
   *   - GET /api/auth/user-organizations?... (organization discovery)
   *   - POST /api/auth/login (login must hit external)
   *
   * Rationale: Certain auth flows must bypass local/proxied base URLs to ensure
   * consistency across environments, while allowing other API calls to use
   * existing base URL logic.
   */

  const safeBase = String(baseUrl || '').replace(/\/+$/, '');
  const safePath = String(path || '');

  const OVERRIDES = [
    /\/api\/auth\/user-organizations(?:\/)?(\?|$)/,
    /\/api\/auth\/login(?:\/)?(\?|$)/,
  ];

  const shouldForceExternal = OVERRIDES.some((re) => re.test(safePath));

  if (shouldForceExternal) {
     const ABS_EXTERNAL_BASE = 'https://kaviabeta-worktool.cloud.kavia.ai';
    const finalPath = safePath.startsWith('/') ? safePath : `/${safePath}`;
    return `${ABS_EXTERNAL_BASE}${finalPath}`;
  }

  if (!safePath) return safeBase;
  const joinedPath = safePath.startsWith('/') ? safePath : `/${safePath}`;
  return `${safeBase}${joinedPath}`;
}