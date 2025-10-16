import axios from "axios";

/**
 * Axios API client
 * - Prefers REACT_APP_API_URL or REACT_APP_API_BASE_URL if provided.
 * - Otherwise, for https origins, uses same-origin with CRA proxy (relative /api).
 * - For http origins, falls back to hostname:3001.
 */

// Attempt to infer backend base when env is not set.
function inferBackendBase() {
  try {
    if (typeof window === "undefined") return "";
    const { protocol, hostname } = window.location;
    const proto = (protocol || "").replace(":", "");
    // If current page is https, avoid inferring a different origin to prevent mixed content.
    if (proto === "https") return "";
    const backendPort = process.env.REACT_APP_BACKEND_PORT || "3001";
    return `${protocol}//${hostname}:${backendPort}`;
  } catch {
    return "";
  }
}

// Normalize base URL + prefix, avoiding double slashes
function joinUrl(base, path) {
  if (!base) return path || "";
  const b = base.endsWith("/") ? base.slice(0, -1) : base;
  const p = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  return `${b}${p}`;
}

const RAW_BASE_URL =
  process.env.REACT_APP_API_URL ||
  process.env.REACT_APP_API_BASE_URL ||
  inferBackendBase() ||
  "";

const API_PREFIX = process.env.REACT_APP_API_PREFIX || "/api";
const API_BASE_URL = joinUrl(RAW_BASE_URL, API_PREFIX);

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

/**
 * Normalize server responses:
 * - If array => items = array
 * - If envelope => use payload.data, payload.meta.total
 */
function normalizeListResponse(res) {
  const payload = res?.data ?? {};
  const items = Array.isArray(payload) ? payload : payload.data || [];
  const total =
    (payload.meta && typeof payload.meta.total === "number" && payload.meta.total) ||
    (Array.isArray(items) ? items.length : 0);
  return { items, total, meta: payload.meta || null };
}

// PUBLIC_INTERFACE
export function getApiClient() {
  /** Returns the configured Axios instance */
  return api;
}

// PUBLIC_INTERFACE
export async function health() {
  /** Checks backend availability using /openapi.json (proxied when same-origin). */
  const rootBase = RAW_BASE_URL || "";
  const url = rootBase ? joinUrl(rootBase, "/openapi.json") : "/openapi.json";
  const res = await axios.get(url);
  return res.data;
}

// PUBLIC_INTERFACE
export async function listUsers(params = {}) {
  /** List users with optional pagination/filter/sort. Returns {items,total,meta} */
  const res = await api.get("/users", { params });
  return normalizeListResponse(res);
}

// PUBLIC_INTERFACE
export async function createUser(body) {
  /** Create user and return created document */
  const res = await api.post("/users", body);
  return res.data?.data ?? res.data;
}

// PUBLIC_INTERFACE
export async function updateUser(id, body) {
  /** Update user document by id and return updated document */
  const res = await api.put(`/users/${id}`, body);
  return res.data?.data ?? res.data;
}

// PUBLIC_INTERFACE
export async function deleteUser(id) {
  /** Delete user document by id and return result */
  const res = await api.delete(`/users/${id}`);
  return res.data?.data ?? res.data;
}

// PUBLIC_INTERFACE
export async function listSessions(params = {}) {
  /** List session tracking documents. Returns {items,total,meta} */
  const res = await api.get("/session-tracking", { params });
  return normalizeListResponse(res);
}

// PUBLIC_INTERFACE
export async function createSession(body) {
  /** Create a session tracking record */
  const res = await api.post("/session-tracking", body);
  return res.data?.data ?? res.data;
}

// PUBLIC_INTERFACE
export async function updateSession(id, body) {
  /** Update a session tracking record by id */
  const res = await api.put(`/session-tracking/${id}`, body);
  return res.data?.data ?? res.data;
}

// PUBLIC_INTERFACE
export async function deleteSession(id) {
  /** Delete a session tracking record by id */
  const res = await api.delete(`/session-tracking/${id}`);
  return res.data?.data ?? res.data;
}

// PUBLIC_INTERFACE
export async function listDeployments(params = {}) {
  /** List app deployments. Returns {items,total,meta} */
  const res = await api.get("/app-deployments", { params });
  return normalizeListResponse(res);
}

// PUBLIC_INTERFACE
export async function listLlmCosts(params = {}) {
  /** List LLM cost records. Returns {items,total,meta} */
  const res = await api.get("/llm-costs", { params });
  return normalizeListResponse(res);
}

// PUBLIC_INTERFACE
export async function getUserCosts(userId) {
  /** Placeholder: Example to get user-related costs; currently lists users */
  if (!userId) throw new Error("userId is required");
  const res = await api.get(`/users`);
  return res.data?.data ?? res.data;
}

// PUBLIC_INTERFACE
export async function getUserProjectsCosts(userId) {
  /** Placeholder: Example to get user project costs; currently lists users */
  if (!userId) throw new Error("userId is required");
  const res = await api.get(`/users`);
  return res.data?.data ?? res.data;
}
