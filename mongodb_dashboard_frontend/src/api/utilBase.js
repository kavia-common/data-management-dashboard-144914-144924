import { getApiBase as getConfiguredBase } from "./config";

/**
 * PUBLIC_INTERFACE (Deprecated)
 * getApiBase
 * Deprecated shim kept for backward compatibility. Delegates to config.getApiBase().
 * Ensures returned value includes '/api' suffix.
 */
export function getApiBase() {
  const base = String(getConfiguredBase() || "").replace(/\/+$/, "");
  return base.endsWith("/api") ? base : `${base}/api`;
}

export default { getApiBase };
