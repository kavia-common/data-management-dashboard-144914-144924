const { createProxyMiddleware } = require("http-proxy-middleware");

/**
 * PUBLIC_INTERFACE
 * CRA dev server proxy.
 *
 * Proxies API calls and OpenAPI docs to the backend target to avoid mixed-content and CORS issues.
 * Target resolution priority:
 * 1) REACT_APP_API_BASE_URL or REACT_APP_API_URL (must include protocol, host, and optional /api suffix)
 * 2) http://{REACT_APP_PROXY_HOST}:{REACT_APP_BACKEND_PORT}
 * 3) http://172.17.0.2:3001 (safe default for Docker bridge when frontend runs separate from backend)
 *
 * Notes:
 * - changeOrigin: true allows virtual hosted sites
 * - secure: false permits self-signed certs if target is https (dev only)
 */
module.exports = function setupProxy(app) {
  const port = process.env.REACT_APP_BACKEND_PORT || process.env.PORT || "3001";
  const host =
    process.env.REACT_APP_PROXY_HOST && process.env.REACT_APP_PROXY_HOST.trim()
      ? process.env.REACT_APP_PROXY_HOST.trim()
      : null;

  // Prefer same host (preview domain) for proxy target with backend port 3001 to avoid CORS/localhost issues.
  let sameHostTarget = null;
  try {
    if (typeof process !== 'undefined') {
      // When running under CRA dev server, use the request host header via a resolver function in http-proxy-middleware.
      // Fallback default constructed below if needed.
    }
    // As a safe default, construct using window-like host assumption via environment PUBLIC_HOST if provided by platform.
    const publicHost = process.env.PUBLIC_HOST || process.env.REACT_APP_PUBLIC_HOST || null;
    if (publicHost) {
      sameHostTarget = `http://${publicHost}:${port}`;
    }
  } catch {
    // ignore
  }

  const target =
    (process.env.REACT_APP_API_BASE_URL && process.env.REACT_APP_API_BASE_URL.trim()) ||
    (process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL.trim()) ||
    (host ? `http://${host}:${port}` : sameHostTarget || `http://127.0.0.1:${port}`);

  const commonOpts = {
    target,
    changeOrigin: true,
    secure: false,
    logLevel: "warn",
  };

  // Proxy API prefix (same-origin usage recommended in client: fetch('/api/...'))
  app.use(
    "/api",
    createProxyMiddleware({
      ...commonOpts,
    })
  );

  // Proxy OpenAPI spec and health endpoints
  app.use(
    "/openapi.json",
    createProxyMiddleware({
      ...commonOpts,
    })
  );

  // Health info passthrough for preview verification
  app.use(
    "/api/_health_info",
    createProxyMiddleware({
      ...commonOpts,
    })
  );
};
