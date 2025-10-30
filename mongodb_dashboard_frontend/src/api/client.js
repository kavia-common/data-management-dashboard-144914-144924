import axios from "axios";

/**
 * PUBLIC_INTERFACE
 * getApiClient
 * API client configured with base URL, adding Authorization and X-Active-Tenant headers from localStorage if present.
 * To configure deployment base URL, set REACT_APP_API_BASE_URL and optionally REACT_APP_API_PREFIX in environment.
 *
 * Normalization rules:
 * - Base origin is taken from REACT_APP_API_BASE_URL if provided; otherwise from window.location (default port 3001).
 * - API prefix defaults to "/api" and is included exactly once.
 * - Final baseURL looks like: http(s)://host:port/api
 */
const ENV_BASE = (process.env.REACT_APP_API_BASE_URL || "").trim();
const ENV_PREFIX = (process.env.REACT_APP_API_PREFIX || "/api").trim();

function normalizePrefix(p) {
  const pref = p || "/api";
  const withLead = pref.startsWith("/") ? pref : `/${pref}`;
  return withLead.replace(/\/+$/, ""); // remove trailing slash
}

function getWindowOrigin() {
  try {
    const { protocol, hostname, port } = window.location;
    // If app runs on 3000 (CRA), backend is on 3001 by convention
    const finalPort = port || (protocol === "https:" ? "443" : "80");
    const origin = `${protocol}//${hostname}${finalPort ? `:${finalPort}` : ""}`;
    return origin;
  } catch {
    // Non-browser fallback for tests
    return "http://localhost:3001";
  }
}

// Build normalized base URL
let API_BASE_URL = "";
const prefix = normalizePrefix(ENV_PREFIX);

if (ENV_BASE) {
  const trimmedBase = ENV_BASE.replace(/\/+$/, "");
  const hasApiSuffix = /\/api$/.test(trimmedBase);
  API_BASE_URL = hasApiSuffix ? trimmedBase : `${trimmedBase}${prefix}`;
} else if (typeof window !== "undefined" && window.__API_BASE_URL__) {
  const winBase = String(window.__API_BASE_URL__).trim();
  if (/^https?:\/\//i.test(winBase)) {
    const trimmed = winBase.replace(/\/+$/, "");
    const hasApiSuffix = /\/api$/.test(trimmed);
    API_BASE_URL = hasApiSuffix ? trimmed : `${trimmed}${prefix}`;
  } else {
    // relative provided; join with current origin
    const origin = getWindowOrigin();
    const rel = winBase.startsWith("/") ? winBase : `/${winBase}`;
    const trimmed = rel.replace(/\/+$/, "");
    const hasApiSuffix = /\/api$/.test(trimmed);
    API_BASE_URL = hasApiSuffix ? `${origin}${trimmed}` : `${origin}${prefix}`;
  }
} else {
  // Default to current origin but ensure backend port 3001 if running on 3000
  let origin = getWindowOrigin();
  try {
    const url = new URL(origin);
    const port = url.port || (url.protocol === "https:" ? "443" : "80");
    if (port === "3000") {
      origin = `${url.protocol}//${url.hostname}:3001`;
    }
  } catch {
    // ignore
  }
  API_BASE_URL = `${origin}${prefix}`;
}

// eslint-disable-next-line no-console
console.debug("[api] baseURL:", API_BASE_URL);

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
