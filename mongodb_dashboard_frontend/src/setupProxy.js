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

  // Avoid localhost when running in separate containers to prevent EADDRNOTAVAIL.
  const defaultBridge = `http://172.17.0.2:${port}`;

  const target =
    (process.env.REACT_APP_API_BASE_URL && process.env.REACT_APP_API_BASE_URL.trim()) ||
    (process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL.trim()) ||
    (host ? `http://${host}:${port}` : defaultBridge);

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
