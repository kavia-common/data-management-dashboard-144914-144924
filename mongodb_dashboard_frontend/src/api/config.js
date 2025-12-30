//
// Centralized API base URL used by API clients
/**
 * Keep this URL exactly as provided.
 * Note:
 * - Backend expects tenant context via header `x-organization-id` (preferred). Query aliases ?organization_id or ?tenant_id are supported.
 * - In previews, ensure the backend origin here is allowed by backend CORS (it is via permissive /api CORS with OPTIONS support).
 */
//
const apiBase =
  //  `https://kavia-dashboard-kavia-dev.cloud.kavia.ai/api`;
  'https://vscode-internal-25447-beta.beta01.cloud.kavia.ai:3001/api';
// `https://kavia-dashboard-kavia-beta.cloud.kavia.ai/api`

/**
 * PUBLIC_INTERFACE
 * getApiBase
 * Returns the base URL for backend API requests.
 * This exists for modules that expect a function-based accessor.
 */
export function getApiBase() {
  return apiBase;
}

// Default export as an object to match existing import style in the codebase
const config = {
  apiBase,
  getApiBase,
};

export default config;

// Also provide a named export for modules that import { apiBase }
export { apiBase };

