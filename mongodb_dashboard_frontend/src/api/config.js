export function getApiBaseUrl() {
  // Use proxy in development; otherwise use relative base
  // setupProxy.js handles /api -> backend in dev.
  return window.location.origin;
}

// PUBLIC_INTERFACE
export function getApiBase() {
  /** Backward-compatible alias used elsewhere in the app */
  return getApiBaseUrl();
}
