import { getApiBase } from "./config";
import { buildAuthHeaders, getOrganizationId } from "./authTokenProvider";
import { applyTenantScopeToRequest, resolveEffectiveTenantId } from "./tenantScope";

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
  /**
   * Session tracking list endpoint detection.
   *
   * IMPORTANT INVARIANT:
   * - The backend route is `/api/session-tracking` (hyphen).
   * - Some older/alternate code may still refer to `/api/session_tracking` (underscore).
   *
   * This helper must recognize BOTH forms so tenant scoping and param sanitization
   * are applied consistently, otherwise list calls may fail with:
   *   400: "tenant_id is required"
   */
  if (typeof pathOrUrl !== "string") return false;

  const re = /\/api\/session[-_]?tracking(?:$|[?&#/])/;
  const reId = /\/api\/session[-_]?tracking\/[A-Za-z0-9_-]/;

  return re.test(pathOrUrl) && !reId.test(pathOrUrl);
}

/**
 * For endpoint-specific rules, sanitize query params before building the request.
 * - For "/api/users" GET: allow only { organization_id }.
 * - For "/api/session-tracking" root: strip organization_id, allow tenant_id only (appended later).
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
    return out;
  }

  if (isSessionTrackingRoot(pathOrUrl)) {
    /**
     * Session Tracking list endpoint contract:
     * - Backend supports dedicated filtering via query params like `user_name`, `userId`, `q`, `start/end`, etc.
     * - Backend ignores `filter` (legacy JSON filter param) for this endpoint.
     * - Tenant scoping is handled separately (ensureScopedQueryParams => tenant_id).
     *
     * Therefore we ONLY strip parameters that are known-bad/ignored (`organization_id`, `filter`)
     * and preserve everything else (including `user_name`) to avoid breaking UI filters.
     */
    const { organization_id, filter, ...rest } = params || {};
    return rest || {};
  }

  // For llm-costs list root: strip 'filter' and any date-range params per backend contract
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
      // keep everything else like page, limit, sort, organization_id
      ...rest
    } = params || {};
    return rest || {};
  }

  /**
   * IMPORTANT:
   * /api/dashboard/users is an analytics endpoint that supports query params like:
   *   - from/to (time window)
   *   - tenant_id (analytics tenant filter)
   * We must NOT sanitize these away.
   *
   * This rule exists because other endpoints (e.g. /api/users root) intentionally
   * accept only organization_id for scoping.
   */
  const isDashboardUsersAnalytics =
    typeof pathOrUrl === "string" && /\/api\/dashboard\/users(?:$|[?&#/])/.test(pathOrUrl);

  if (isDashboardUsersAnalytics) {
    return params || {};
  }

  return params || {};
}

/**
 * Ensure query scoping parameters.
 * - For users endpoints: append organization_id (and only that for certain paths).
 * - For session-tracking root: append tenant_id instead of organization_id.
 * - Default: append organization_id if missing.
 */
function ensureScopedQueryParams(pathOrUrl, params = {}) {
  const pathStr = String(pathOrUrl || "");

  const isTenantSummary =
    typeof pathOrUrl === "string" &&
    /\/api\/users\/tenant-summary(?:$|[?&#/])/.test(pathOrUrl);

  const isUsersRoot =
    typeof pathOrUrl === "string" &&
    /\/api\/users(?:$|[?&#/])/.test(pathOrUrl) &&
    !/\/api\/users\/[A-Za-z0-9_-]/.test(pathOrUrl);

  const isProjectsSummary =
    typeof pathOrUrl === "string" &&
    /\/api\/projects\/summary(?:$|[?&#/])/.test(pathStr);

  const orgId = getOrganizationId();

  if (isSessionTrackingRoot(pathOrUrl)) {
    // For session tracking, enforce tenant_id in query. We use stored organization id as tenant_id value.
    const existingHasTenant =
      "tenant_id" in (params || {}) ||
      (typeof pathOrUrl === "string" && /([?&])tenant_id=/.test(pathOrUrl));
    if (existingHasTenant) return params || {};
    if (!orgId) return params || {};
    return { ...(params || {}), tenant_id: orgId };
  }

  const baseParams = {};
  if (orgId) baseParams.organization_id = orgId;

  /**
   * IMPORTANT:
   * - Some endpoints must be called with ONLY organization_id (strict scoping), e.g.:
   *     - /api/users (root)
   *     - /api/users/tenant-summary
   * - DO NOT apply this restriction broadly, otherwise we may drop legitimate params
   *   like tenant_id/from/to for analytics endpoints (e.g. /api/dashboard/users).
   */
  if (isTenantSummary || isUsersRoot) {
    return baseParams; // strictly only organization_id
  }

  // For /api/projects/summary: ALWAYS ensure organization_id is appended to query
  if (isProjectsSummary) {
    const merged = { ...(params || {}) };
    if (!("organization_id" in merged) && orgId) {
      merged.organization_id = orgId;
    }
    return merged;
  }

  // Default behavior: if caller already provided organization_id or tenant_id, respect it.
  const existingHasOrg =
    "organization_id" in (params || {}) ||
    (typeof pathOrUrl === "string" && /([?&])organization_id=/.test(pathOrUrl));
  const existingHasTenant =
    "tenant_id" in (params || {}) ||
    (typeof pathOrUrl === "string" && /([?&])tenant_id=/.test(pathOrUrl));

  if (existingHasOrg || existingHasTenant) return params || {};
  if (!orgId) return params || {};
  return { ...(params || {}), ...baseParams };
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
  const effParams = sanitizeEndpointParams(
    pathOrUrl,
    ensureScopedQueryParams(pathOrUrl, params)
  );
  const url = buildUrlWithParams(pathOrUrl, effParams);
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.debug('[api/baseClient] GET', url);
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
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.debug(`[api/baseClient] ${method}`, url);
  }
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
  const items = Array.isArray(payload) ? payload : payload?.data || [];
  const total =
    (payload && payload.meta && typeof payload.meta.total === "number" && payload.meta.total) ||
    (Array.isArray(items) ? items.length : 0);
  return { items, total, meta: payload?.meta || null };
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
  /** Lists users; for /api/users only organization_id is sent. All other params (e.g., limit, page, sort, filter) are ignored for this endpoint by design. Returns normalized { items, total, meta }. */
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

/**
 * PUBLIC_INTERFACE
 * listDeployments
 * Lists app deployments normalized to { items, total, meta }.
 */
export async function listDeployments(params = {}) {
  /** Lists app deployments normalized to { items, total, meta }. */
  const res = await httpGet("/api/app-deployments", { params });
  return normalizeListPayload(res.data);
}

/**
 * PUBLIC_INTERFACE
 * listDashboardUsersAnalytics
 * Fetches fully aggregated per-user analytics from GET /api/dashboard/users.
 *
 * IMPORTANT CONTRACT:
 * - This endpoint is the sole source of user analytics for the Users Analytics panel.
 * - The backend returns already-aggregated per-user totals; frontend must not batch
 *   per-user calls or do client-side aggregation.
 *
 * Query params:
 *  - from?: ISO date-time or YYYY-MM-DD (backend expands date-only to UTC day bounds)
 *  - to?: ISO date-time or YYYY-MM-DD
 *
 * Default:
 *  - If from/to are omitted, backend defaults to TODAY in UTC.
 *
 * Returns:
 *  - Array<{ userId, name, email, totalSessions, distinctProjects, lastActivityAt }>
 */
export async function listDashboardUsersAnalytics(params = {}, options = {}) {
  /**
   * Tenant scoping:
   * - Backend requires tenant scope, preferring `x-organization-id` header.
   * - For Users Analytics, we may ALSO pass `tenant_id` as an analytics filter param.
   *
   * This function ensures:
   * - when a tenant is selected, we always include `x-organization-id`
   * - we do NOT rely on legacy query params for scoping unless explicitly enabled
   */
  const effectiveTenantId = resolveEffectiveTenantId(params?.tenant_id || params?.organization_id);

  const scoped = applyTenantScopeToRequest(
    { headers: options?.headers, params },
    effectiveTenantId,
    {
      preferHeader: true,
      legacyQueryFallback: false, // preferred behavior; avoid patchy mixed modes
      debugLabel: "listDashboardUsersAnalytics",
    }
  );

  const res = await httpGet("/api/dashboard/users", {
    params: scoped.params,
    headers: scoped.headers,
    signal: options?.signal,
  });

  // Backward compatible parsing:
  // - Old backend shape: Array<perUserRow>
  // - New backend shape: { success, interval, activity: [...], users: [...] }
  if (Array.isArray(res.data)) {
    return { activity: null, users: res.data, interval: null, meta: null };
  }

  const activity = Array.isArray(res.data?.activity) ? res.data.activity : null;
  const users = Array.isArray(res.data?.users) ? res.data.users : [];
  const interval = typeof res.data?.interval === "string" ? res.data.interval : null;

  // Range-based mode support:
  // - mode === 'per_user' => activityByUser is provided (buckets + series)
  // - mode === 'aggregated' => activity (buckets) is provided (existing behavior)
  const mode = typeof res.data?.mode === "string" ? res.data.mode : null;
  const activityByUser =
    res.data?.activityByUser && typeof res.data.activityByUser === "object"
      ? res.data.activityByUser
      : null;

  return {
    activity,
    activityByUser,
    mode,
    users,
    interval,
    meta: {
      from: res.data?.from || null,
      to: res.data?.to || null,
      success: !!res.data?.success,
    },
  };
}

/**
 * PUBLIC_INTERFACE
 * listLlmCosts
 * Legacy hyphen route kept for backward-compat in charts. Prefer listLlmCostsUnderscore (/api/llm_costs) for new code.
 */
export async function listLlmCosts(params = {}) {
  /** Lists LLM cost records normalized to { items, total, meta }. */
  const res = await httpGet("/api/llm-costs", { params });
  return normalizeListPayload(res.data);
}

// PUBLIC_INTERFACE
export async function listLlmCostsUnderscore(params = {}, options = {}) {
  /** Lists aggregated/tabular LLM costs from /api/llm_costs with support for organization_id, page, limit. Returns normalized { items, total, meta } when envelope-like structure is present, else raw array under items. */
  const res = await httpGet("/api/llm_costs", { params, signal: options.signal });
  const payload = res.data;
  if (payload && typeof payload === "object" && Array.isArray(payload.data)) {
    // Envelope shape from backend controller
    return { items: payload.data, total: payload.meta?.total ?? payload.data.length, meta: payload.meta || null };
  }
  // Fallback: array response
  return { items: Array.isArray(payload) ? payload : [], total: Array.isArray(payload) ? payload.length : 0, meta: null };
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
