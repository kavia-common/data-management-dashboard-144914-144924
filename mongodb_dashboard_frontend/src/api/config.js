//
// Centralized API base URL used by API clients.
// Keep this URL exactly as provided by the environment or project bootstrap.
//

// PUBLIC_INTERFACE
/** Returns the API base URL (including /api). */
export function getApiBase() {
  // Prefer environment-based configuration when available; fallback to bootstrap default.
  const envBase =
    process.env.REACT_APP_API_BASE_URL ||
    process.env.REACT_APP_API_URL ||
    '';

  // If env is provided, ensure suffix /api
  if (envBase) {
    const base = String(envBase).replace(/\/+$/, '');
    return `${base}/api`;
  }

  // Bootstrap fallback for this environment (unchanged)
  return 'https://vscode-internal-25245-beta.beta01.cloud.kavia.ai:3001/api';
}

// PUBLIC_INTERFACE
/** Backward-compatible default export with apiBase field. */
const apiBase = getApiBase();
const config = {
  apiBase,
  getApiBase
};

export default config;
export { apiBase };
