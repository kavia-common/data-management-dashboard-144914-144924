import axios from "axios";

/**
 * PUBLIC_INTERFACE
 * getApiClient
 * API client configured with base URL, adding Authorization and X-Active-Tenant headers from localStorage if present.
 * To configure deployment base URL, set REACT_APP_API_BASE_URL in environment.
 */
const ENV_BASE = process.env.REACT_APP_API_BASE_URL || "";
const ENV_PREFIX = process.env.REACT_APP_API_PREFIX || "/api";

// Build base: if ENV_BASE is absolute and includes prefix, use as-is.
// If ENV_BASE is provided but lacks '/api', append ENV_PREFIX.
// Else try window override, else default to '/api'.
let computedBase = "";
if (ENV_BASE) {
  const trimmedBase = ENV_BASE.replace(/\/+$/, "");
  // If base already ends with '/api' or a provided prefix, don't double-append
  const alreadyHasApi = /\/api$/.test(trimmedBase);
  computedBase = alreadyHasApi ? trimmedBase : `${trimmedBase}${ENV_PREFIX}`;
} else if (window.__API_BASE_URL__) {
  computedBase = String(window.__API_BASE_URL__).replace(/\/+$/, "") || "/api";
} else {
  computedBase = "/api";
}
const API_BASE_URL = computedBase;

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

// PUBLIC_INTERFACE
export function getApiClient() {
  /** Returns configured Axios instance */
  return api;
}
