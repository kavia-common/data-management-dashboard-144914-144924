import axios from "axios";

/**
 * PUBLIC_INTERFACE
 * getApiClient
 * Axios client configured with baseURL and auth/tenant headers.
 */
export function getApiClient() {
  /** This is a public function. */
  const ENV_BASE = process.env.REACT_APP_API_BASE_URL || "";
  const RAW_BASE_URL = ENV_BASE || (window?.__API_BASE_URL__ || "");
  const API_PREFIX = "/api";

  function joinUrl(base, path) {
    if (!base) return path || "";
    const b = base.endsWith("/") ? base.slice(0, -1) : base;
    const p = path ? (path.startsWith("/") ? path : `/${path}`) : "";
    return `${b}${p}`;
  }

  // If RAW_BASE_URL is blank, axios will use relative path; OK in same-origin setups through proxy
  const API_BASE_URL = joinUrl(RAW_BASE_URL, API_PREFIX);

  const api = axios.create({
    baseURL: API_BASE_URL,
    headers: { "Content-Type": "application/json" },
  });

  api.interceptors.request.use((config) => {
    try {
      const raw = localStorage.getItem("auth");
      if (raw) {
        const auth = JSON.parse(raw);
        if (auth?.token) {
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${auth.token}`;
        } else if (auth?.loggedIn) {
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ok`;
        }
      }
      const activeTenant = localStorage.getItem("activeTenant");
      if (activeTenant) {
        config.headers = config.headers || {};
        config.headers["X-Active-Tenant"] = activeTenant;
      }
    } catch {
      // ignore
    }
    return config;
  });

  return api;
}
