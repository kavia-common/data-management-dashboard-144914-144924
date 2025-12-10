import { getApiBase } from "./config";
import { buildAuthHeaders, getOrganizationId } from "./authTokenProvider";

/**
 * Internal helper: detect absolute URLs.
 */
function isAbsoluteUrl(url) {
  return /^https?:\/\//i.test(String(url || ""));
}

/**
 * Internal helper: join base and path, avoiding double slashes.
 * Handles:
 * - relative paths like "/users"
 * - "/api/..." paths (joins with base root, stripping trailing "/api")
 * - absolute URLs (returned as-is)
 */
function buildUrl(pathOrUrl) {
  const base = getApiBase(); // e.g., "http://host:3001/api"
  if (isAbsoluteUrl(pathOrUrl)) return pathOrUrl;

  const baseRoot = String(base).replace(/\/+$/, "");
  const hasApiSuffix = /\/api$/.test(baseRoot);

  const path = String(pathOrUrl || "");
  if (path.startsWith("/api")) {
    // Join against base root (strip trailing "/api" from base)
    const root = hasApiSuffix ? baseRoot.replace(/\/api$/, "") : baseRoot;
    return `${root}${path}`;
  }

  // Normal: join base+"/api" with relative path
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${baseRoot}${p}`;
}

/**
 * Internal helper: build query string from params.
 * Merges existing querystring in a safe way if caller passes a URL containing ? already.
 */
function toQuery(params = {}) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    if (Array.isArray(v)) {
      v.forEach((val) => usp.append(k, String(val)));
    } else if (typeof v === "object") {
      usp.append(k, JSON.stringify(v));
    } else {
      usp.append(k, String(v));
    }
  });
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Determine if the requested path is the session-tracking collection root.
 */
function isSessionTrackingRoot(pathOrUrl) {
  return (
    typeof pathOrUrl === "string" &&
    /\/api\/session-tracking(?:$|[?&#/])/.test(pathOrUrl) &&
    !/\/api\/session-tracking\/[A-Za-z0-9_-]/.test(pathOrUrl)
  );
}

/**
 * For endpoint-specific rules, sanitize query params before building the request.
 * - For "/api/users" GET: allow only { organization_id }.
 * - For "/api/session-tracking" root: strip organization_id; backend expects tenant_id (appended via ensureScopedQueryParams).
 * - For "/api/llm-costs": strip unsupported filter/date params; we let backend apply window defaults.
 */
function sanitizeEndpointParams(pathOrUrl, params = {}) {
  const path = String(pathOrUrl || "");
  const isUsersRoot =
    /\/api\/users(?:$|\?)/.test(path) && !/\/api\/users\/[A-Za-z0-9_-]/.test(path);

  if (isUsersRoot) {
    const out = {};
    if (params && typeof params === "object" && "organization_id" in params) {
      out.organization_id = params.organization_id;
    }
    if ("page" in params) out.page = params.page;
    if ("limit" in params) out.limit = params.limit;
    if ("sort" in params) out.sort = params.sort;
    return out;
  }

  if (isSessionTrackingRoot(pathOrUrl)) {
    // Remove any organization_id remnants for session-tracking
    const { organization_id, filter, ...rest } = params || {};
    return rest || {};
  }

  const isLlmCostsRoot =
    typeof pathOrUrl === "string" &&
    /\/api\/llm-costs(?:$|[?&#/])/.test(pathOrUrl) &&
    !/\/api\/llm-costs\/[A-Za-z0-9_-]/.test(pathOrUrl);

  if (isLlmCostsRoot) {
    const {
      filter,
      start,
      end,
      from,
      to,
      ...rest
    } = params || {};
    return rest || {};
  }

  return params || {};
}

/**
 * Ensure query scoping parameters.
 * - For session-tracking root: append tenant_id instead of organization_id.
 * - Default: append organization_id if missing.
 */
function ensureScopedQueryParams(pathOrUrl, params = {}) {
  const orgId = getOrganizationId();

  if (isSessionTrackingRoot(pathOrUrl)) {
    const existingHasTenant =
      "tenant_id" in (params || {}) ||
      (typeof pathOrUrl === "string" && /([?&])tenant_id=/.test(pathOrUrl));
    if (existingHasTenant) return params || {};
    if (!orgId) return params || {};
    return { ...(params || {}), tenant_id: orgId };
  }

  const existingHasOrg =
    "organization_id" in (params || {}) ||
    (typeof pathOrUrl === "string" && /([?&])organization_id=/.test(pathOrUrl));
  if (existingHasOrg) return params || {};
  if (!orgId) return params || {};
  return { ...(params || {}), organization_id: orgId };
}

/**
 * Merge a possibly pre-queried pathOrUrl with an extra params object safely.
 */
function buildUrlWithParams(pathOrUrl, effParams) {
  if (!effParams || Object.keys(effParams).length === 0) {
    return buildUrl(pathOrUrl);
  }
  // If pathOrUrl already has its own query, merge them
  if (typeof pathOrUrl === "string" && pathOrUrl.includes("?")) {
    const [base, existingQs] = pathOrUrl.split("?");
    const usp = new URLSearchParams(existingQs);
    Object.entries(effParams).forEach(([k, v]) => {
      if (v === undefined || v === null || v === "") return;
      // Overwrite existing key to ensure scoping param wins
      usp.set(k, String(v));
    });
    return buildUrl(`${base}?${usp.toString()}`);
  }
  // Normal path
  return buildUrl(`${pathOrUrl}${toQuery(effParams)}`);
}

/**
 * Internal helper: parse response and return { ok, status, data|text }.
 */
async function parseResponse(res) {
  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  try {
    const payload = isJson ? await res.json() : await res.text();
    return { ok: res.ok, status: res.status, payload };
  } catch {
    return { ok: res.ok, status: res.status, payload: null };
  }
}

/**
 * Axios-like "get" returning { data }.
 */
async function httpGet(pathOrUrl, { params, headers, signal } = {}) {
  // Build scoped params first (ensures organization_id/tenant_id present when needed)
  const scoped = ensureScopedQueryParams(pathOrUrl, params);
  // Sanitize endpoint-specific rules (prevents stripping the tenant params)
  const effParams = sanitizeEndpointParams(pathOrUrl, scoped);
  const url = buildUrlWithParams(pathOrUrl, effParams);

  if (process.env.NODE_ENV !== "production") {
    try {
      // eslint-disable-next-line no-console
      console.debug("[httpGet] ->", url);
    } catch {}
  }

  const res = await fetch(url, {
    method: "GET",
    headers: buildAuthHeaders({
      Accept: "application/json",
      ...(headers || {}),
    }),
    signal,
    credentials: "omit",
  });
  const { ok, status, payload } = await parseResponse(res);
  if (!ok) {
    const message =
      (payload && typeof payload === "object" && (payload.message || payload.detail)) ||
      (typeof payload === "string" ? payload : `Request failed (${status})`);
    const err = new Error(message);
    err.status = status;
    err.payload = payload;
    throw err;
  }
  return { data: payload };
}

async function httpJson(method, pathOrUrl, body, { headers, signal, params } = {}) {
  // Append scoped params depending on endpoint and sanitize per-endpoint
  const effParams = sanitizeEndpointParams(
    pathOrUrl,
    ensureScopedQueryParams(pathOrUrl, params)
  );
  const url = buildUrlWithParams(pathOrUrl, effParams);
  const res = await fetch(url, {
    method,
    headers: buildAuthHeaders({
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(headers || {}),
    }),
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
    credentials: "omit",
  });
  const { ok, status, payload } = await parseResponse(res);
  if (!ok) {
    const message =
      (payload && typeof payload === "object" && (payload.message || payload.detail)) ||
      (typeof payload === "string" ? payload : `Request failed (${status})`);
    const err = new Error(message);
    err.status = status;
    err.payload = payload;
    throw err;
  }
  return { data: payload };
}

function normalizeListPayload(payload) {
  // Handle shapes:
  // - envelope: { success, data: [...], meta: { total, page, limit } }
  // - raw array: [...]
  // - fallback: { items: [...] }
  let items;
  if (Array.isArray(payload)) {
    items = payload;
  } else if (payload && Array.isArray(payload.data)) {
    items = payload.data;
  } else if (payload && Array.isArray(payload.items)) {
    items = payload.items;
  } else {
    items = [];
  }

  const total =
    (payload && payload.meta && typeof payload.meta.total === "number" && payload.meta.total) ||
    (Array.isArray(items) ? items.length : 0);

  const meta = payload && payload.meta ? payload.meta : null;

  return { items, total, meta };
}

// PUBLIC_INTERFACE
export function getApiClient() {
  /** Returns a minimal axios-like client with get/post/put/delete that uses fetch under the hood. */
  return {
    get: (pathOrUrl, options = {}) => httpGet(pathOrUrl, options),
    post: (pathOrUrl, body, options = {}) => httpJson("POST", pathOrUrl, body, options),
    put: (pathOrUrl, body, options = {}) => httpJson("PUT", pathOrUrl, body, options),
    delete: (pathOrUrl, options = {}) => httpJson("DELETE", pathOrUrl, undefined, options),
  };
}

// PUBLIC_INTERFACE
export async function health() {
  /** Backend health: prefer absolute base root "/" on backend host, but support "/api/auth/health" fallback. */
  try {
    const base = getApiBase(); // ends with /api
    const root = String(base).replace(/\/api$/, "");
    const res = await httpGet(`${root}/`);
    return res.data;
  } catch {
    const res = await httpGet("/api/auth/health");
    return res.data;
  }
}

// PUBLIC_INTERFACE
export async function listUsers(params = {}) {
  /** Lists users; for /api/users only organization_id is sent. Returns normalized { items, total, meta }. */
  const res = await httpGet("/api/users", { params });
  return normalizeListPayload(res.data);
}

// PUBLIC_INTERFACE
export async function listSessions(params = {}) {
  /** Lists session tracking records normalized to { items, total, meta }.
   * Tenant scoping is enforced via tenant_id in the query.
   */
  const res = await httpGet("/api/session-tracking", { params });
  return normalizeListPayload(res.data);
}

// PUBLIC_INTERFACE
export async function listDeployments(params = {}) {
  /** Lists app deployments normalized to { items, total, meta }. */
  const res = await httpGet("/api/app-deployments", { params });
  return normalizeListPayload(res.data);
}

// PUBLIC_INTERFACE
export async function listLlmCosts(params = {}) {
  /** Lists LLM cost records normalized to { items, total, meta }. */
  const res = await httpGet("/api/llm-costs", { params });
  return normalizeListPayload(res.data);
}

/**
 * PUBLIC_INTERFACE
 * getTenantUsersSummaryStrict
 * Calls /api/users/tenant-summary ensuring only organization_id is sent as a query param.
 * Any additional params provided are ignored to prevent accidental leakage of unsupported params.
 */
export async function getTenantUsersSummaryStrict() {
  const res = await httpGet("/api/users/tenant-summary", { params: {} });
  return res.data;
}

/* No default export to favor named exports (lint rule) */
