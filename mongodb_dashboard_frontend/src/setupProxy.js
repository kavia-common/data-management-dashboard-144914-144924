const { createProxyMiddleware } = require("http-proxy-middleware");

// PUBLIC_INTERFACE
// CRA dev server proxy with duplicate-install guard for HMR.
// Proxies API and OpenAPI requests to backend target resolved from env.
const PROXY_INSTALLED = Symbol.for("dashboard.proxy.installed");

module.exports = function setupProxy(app) {
  if (app[PROXY_INSTALLED]) {
    return;
  }
  app[PROXY_INSTALLED] = true;

  const port = process.env.REACT_APP_BACKEND_PORT || "3001";
  const target =
    process.env.REACT_APP_API_BASE_URL ||
    process.env.REACT_APP_API_URL ||
    `http://localhost:${port}`;

  const commonOpts = {
    target,
    changeOrigin: true,
    secure: false,
    xfwd: true,
    logLevel: (process.env.REACT_APP_LOG_LEVEL || "warn").toLowerCase(),
    onProxyReq(proxyReq, req, res) {
      // Ensure auth header is forwarded to backend
      if (req.headers && (req.headers.authorization || req.headers.Authorization)) {
        proxyReq.setHeader("authorization", req.headers.authorization || req.headers.Authorization);
      }
      // Forward tenant header if present (demo mode)
      if (req.headers && (req.headers["x-organization-id"] || req.headers["X-Organization-Id"])) {
        proxyReq.setHeader("x-organization-id", req.headers["x-organization-id"] || req.headers["X-Organization-Id"]);
      }
      // Preserve forwarded proto for backend trust setups
      proxyReq.setHeader("X-Forwarded-Proto", "http");
    }
  };

  app.use(
    "/api",
    createProxyMiddleware({
      ...commonOpts
    })
  );

  app.use(
    "/openapi.json",
    createProxyMiddleware({
      ...commonOpts
    })
  );
};
