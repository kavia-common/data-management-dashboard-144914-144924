const { createProxyMiddleware } = require("http-proxy-middleware");

/**
 * PUBLIC_INTERFACE
 * CRA dev server proxy.
 *
 * Proxies API calls and OpenAPI docs to the backend target to avoid mixed-content and CORS issues.
 * Target is chosen using:
 * - REACT_APP_API_BASE_URL or REACT_APP_API_URL if provided
 * - otherwise http://{REACT_APP_PROXY_HOST||localhost}:${REACT_APP_BACKEND_PORT || PORT || 3001}
 *
 * Notes:
 * - changeOrigin: true allows virtual hosted sites
 * - secure: false permits self-signed certs if target is https (dev only)
 */
module.exports = function setupProxy(app) {
  const port = process.env.REACT_APP_BACKEND_PORT || process.env.PORT || "3001";
  // Prefer explicit base URL if set; otherwise, use 127.0.0.1 to avoid ::1/localhost issues and container DNS oddities
  const inferredHost = process.env.REACT_APP_PROXY_HOST || "127.0.0.1";
  const target =
    process.env.REACT_APP_API_BASE_URL ||
    process.env.REACT_APP_API_URL ||
    `http://${inferredHost}:${port}`;
  // Detect probable self-proxy loop (frontend dev server usually runs on 3000)
  const frontendPort = process.env.PORT || "3000";
  const maybeLoop = target.includes(`:${frontendPort}`) || target.includes("://localhost:3000");
  if (maybeLoop) {
    // eslint-disable-next-line no-console
    console.warn(
      `[setupProxy] Warning: proxy target ${target} may cause a self-proxy loop. Consider REACT_APP_BACKEND_PORT=3001 and REACT_APP_PROXY_HOST=127.0.0.1`
    );
  }

  const commonOpts = {
    target,
    changeOrigin: true,
    secure: false,
    logLevel: "warn",
  };

  // Proxy API prefix
  app.use(
    "/api",
    createProxyMiddleware({
      ...commonOpts,
    })
  );

  // Proxy OpenAPI spec for connectivity/health checks
  app.use(
    "/openapi.json",
    createProxyMiddleware({
      ...commonOpts,
    })
  );
};
