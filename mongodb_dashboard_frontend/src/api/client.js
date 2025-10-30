import axios from "axios";

/**
 * PUBLIC_INTERFACE
 * getApiClient
 * API client configured with base URL, adding Authorization and X-Active-Tenant headers from localStorage if present.
 * To configure deployment base URL, set REACT_APP_API_BASE_URL in environment.
 */
const ENV_BASE = process.env.REACT_APP_API_BASE_URL || "";
const DEFAULT_BASE = ENV_BASE || window.__API_BASE_URL__ || "";
// Default to relative /api if no explicit base is set; the backend proxy/container should handle it
const API_BASE_URL = DEFAULT_BASE || "/api";

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
