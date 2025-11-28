const { createProxyMiddleware } = require("http-proxy-middleware");

/**
 * PUBLIC_INTERFACE
 * CRA dev server proxy.
 *
 * Behavior:
 * - If REACT_APP_BACKEND_URL or REACT_APP_API_BASE_URL/REACT_APP_API_URL is set, we honor it as absolute URL and proxy to it.
 * - Otherwise, default to http://127.0.0.1:{port} instead of localhost to avoid EADDRNOTAVAIL when specific interfaces are unavailable.
 * - We do not bind to a specific network interface; http-proxy-middleware handles routing.
 *
 * Memory-friendly dev notes:
 * - Avoid heavy proxy logging (logLevel: "warn").
 * - When pointing directly to a remote BACKEND_URL, you can skip proxy by making fetches absolute (client uses env).
 */
module.exports = function setupProxy(app) {
  const explicitBackend =
    process.env.REACT_APP_BACKEND_URL ||
    process.env.REACT_APP_API_BASE_URL ||
    process.env.REACT_APP_API_URL;

  const port = process.env.REACT_APP_BACKEND_PORT || process.env.PORT || "3001";
  // Force loopback IP to avoid EADDRNOTAVAIL on systems where "localhost" resolves to IPv6 or unavailable interface.
  const host = "127.0.0.1";
  const fallbackTarget = `http://${host}:${port}`;
  const target = explicitBackend || fallbackTarget;

  const commonOpts = {
    target,
    changeOrigin: true,
    secure: false,
    logLevel: "warn",
  };

  // If pointing to an absolute BACKEND_URL with different origin and the app itself already uses absolute URLs,
  // you could avoid proxy entirely. CRA requires a function; we keep proxy but just forward.
  const createHandler = () => createProxyMiddleware(commonOpts);

  // Proxy API prefix
  app.use("/api", createHandler());

  // Proxy OpenAPI spec for connectivity/health checks
  app.use("/openapi.json", createHandler());
};
