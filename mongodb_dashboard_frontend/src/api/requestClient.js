import { buildAuthHeaders, getOrganizationId } from './authTokenProvider';
import { getApiBaseUrl } from './util';

/**
 * RequestClient: fetch-based client with:
 * - in-flight deduplication (method+url+sorted params)
 * - short-lived GET cache with stale-while-revalidate (TTL 90s default)
 * - AbortController support for cancellation
 *
 * PUBLIC_INTERFACE
 *   client.get(url, { params?, headers?, signal?, cacheTTL? })
 *   client.post(url, body, { params?, headers?, signal? })
 *   client.put(url, body, { params?, headers?, signal? })
 *   client.delete(url, { params?, headers?, signal? })
 */

// Internal maps for in-flight deduplication and cache
const inflight = new Map(); // key => { promise, controllers: Set<AbortController> }
const cache = new Map();    // key => { timestamp, data, status, headersSummary }

const DEFAULT_TTL_MS = 90 * 1000;

// Diagnostics toggle for verifying Authorization and response codes on users widgets
const DEBUG_API = String(process.env.REACT_APP_DEBUG_API_USERS || '').trim() === '1';

// Utilities

function isAbsoluteUrl(url) {
  return /^https?:\/\//i.test(String(url || ''));
}

function baseJoin(base, path) {
  const b = String(base || '').replace(/\/+$/, '');
  if (!path) return b;
  const p = String(path);
  if (p.startsWith('/')) return `${b}${p}`;
  return `${b}/${p}`;
}

/**
 * Resolve base URL including '/api'
 */
function getBase() {
  // getApiBaseUrl already returns a fully formed base including '/api'
  return getApiBaseUrl();
}

/**
 * Build final URL from pathOrUrl + params and ensure organization_id query if available.
 */
function buildUrlWithParams(pathOrUrl, params = {}) {
  let url = '';
  if (isAbsoluteUrl(pathOrUrl) || String(pathOrUrl).startsWith('/api')) {
    url = String(pathOrUrl);
  } else {
    url = baseJoin(getBase(), pathOrUrl);
  }

  // Merge params into URL query
  const hasQuery = url.includes('?');
  const [base, qsRaw] = hasQuery ? url.split('?') : [url, ''];
  const usp = new URLSearchParams(qsRaw || '');
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    if (Array.isArray(v)) {
      usp.delete(k);
      v.forEach((vi) => usp.append(k, String(vi)));
    } else if (typeof v === 'object') {
      usp.set(k, JSON.stringify(v));
    } else {
      usp.set(k, String(v));
    }
  });

  // Append organization_id if not present for scoping (safe default; server enforces)
  const orgId = getOrganizationId && getOrganizationId();
  if (orgId && !usp.has('organization_id')) {
    usp.set('organization_id', String(orgId));
  }

  const qs = usp.toString();
  return `${base}${qs ? `?${qs}` : ''}`;
}

/**
 * Deterministic cache/dedupe key: METHOD|URL_WITH_SORTED_PARAMS
 */
function makeKey(method, url) {
  try {
    const u = new URL(url, 'http://x');
    const usp = u.searchParams;
    const pairs = [];
    usp.forEach((value, key) => {
      pairs.push([key, value]);
    });
    pairs.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const sorted = new URLSearchParams();
    for (const [k, v] of pairs) sorted.append(k, v);
    const path = `${u.pathname}${sorted.toString() ? `?${sorted.toString()}` : ''}`;
    return `${method.toUpperCase()}|${path}`;
  } catch {
    // Fallback: raw
    return `${method.toUpperCase()}|${url}`;
  }
}

async function parseResponse(res) {
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  try {
    const payload = isJson ? await res.json() : await res.text();
    return { ok: res.ok, status: res.status, payload };
  } catch {
    return { ok: res.ok, status: res.status, payload: null };
  }
}

function isTargetUsersEndpoint(url) {
  return (
    url.includes('/api/users') ||
    (url.includes('/api/tenants/') && url.includes('/users/usage')) ||
    url.includes('/api/analytics/users/active-trend')
  );
}

// Core request with in-flight dedupe and cache for GET
async function coreRequest(method, pathOrUrl, { params, headers, signal, body, cacheTTL } = {}) {
  const url = buildUrlWithParams(pathOrUrl, params);
  const key = makeKey(method, url);
  const upperMethod = method.toUpperCase();

  // GET cache check
  const allowCache = upperMethod === 'GET';
  const ttl = Number.isFinite(cacheTTL) ? cacheTTL : DEFAULT_TTL_MS;
  const now = Date.now();
  if (allowCache) {
    const hit = cache.get(key);
    if (hit && now - hit.timestamp < ttl) {
      // Background SWR if not inflight
      if (!inflight.has(key)) {
        void (async () => {
          try {
            await performFetch(upperMethod, url, { headers, signal: undefined, body: undefined }, key, true);
          } catch {
            // ignore background refresh failures
          }
        })();
      }
      return { data: hit.data, __fromCache: true };
    }
  }

  // In-flight dedupe
  if (inflight.has(key)) {
    const entry = inflight.get(key);
    return entry.promise;
  }

  // Perform fetch (will populate inflight and cache)
  return performFetch(upperMethod, url, { headers, signal, body }, key, false, allowCache, ttl);
}

async function performFetch(method, url, { headers, signal, body }, key, isRevalidate = false, allowCache = true, ttlMs = DEFAULT_TTL_MS) {
  const fetchPromise = (async () => {
    const builtHeaders = buildAuthHeaders({
      Accept: 'application/json',
      ...(method !== 'GET' ? { 'Content-Type': 'application/json' } : {}),
      ...(headers || {}),
    });

    // Debug: confirm Authorization presence
    if (DEBUG_API && isTargetUsersEndpoint(url)) {
      try {
        const authHeader = builtHeaders.Authorization || builtHeaders.authorization || '';
        // eslint-disable-next-line no-console
        console.log('[API DEBUG][request]', {
          method,
          url,
          hasAuthorization: !!authHeader,
          authorizationLength: typeof authHeader === 'string' ? authHeader.length : 0,
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[API DEBUG] request log error:', e);
      }
    }

    const res = await fetch(url, {
      method,
      headers: builtHeaders,
      body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
      signal,
      credentials: 'omit',
    });

    const parsed = await parseResponse(res);

    if (DEBUG_API && isTargetUsersEndpoint(url)) {
      try {
        const authHeader = builtHeaders.Authorization || builtHeaders.authorization || '';
        // eslint-disable-next-line no-console
        console.log('[API DEBUG][response]', {
          url,
          status: parsed.status,
          ok: parsed.ok,
          hasAuthorization: !!authHeader,
          authorizationLength: typeof authHeader === 'string' ? authHeader.length : 0,
          payloadType: typeof parsed.payload,
          hasLabels: !!parsed?.payload?.labels,
          hasDatasets: !!parsed?.payload?.datasets,
          hasItems: Array.isArray(parsed?.payload?.items),
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[API DEBUG] response log error:', e);
      }
    }

    if (!parsed.ok) {
      const message =
        (parsed.payload && typeof parsed.payload === 'object' && (parsed.payload.message || parsed.payload.detail)) ||
        (typeof parsed.payload === 'string' ? parsed.payload : `Request failed (${parsed.status})`);
      const err = new Error(message);
      err.status = parsed.status;
      err.payload = parsed.payload;
      throw err;
    }

    // Cache GET responses
    if (allowCache && method === 'GET') {
      cache.set(key, {
        timestamp: Date.now(),
        data: parsed.payload,
        status: parsed.status,
        headersSummary: res.headers.get('etag') || res.headers.get('last-modified') || '',
      });
    }
    return { data: parsed.payload };
  })();

  if (!isRevalidate) {
    inflight.set(key, {
      promise: fetchPromise.finally(() => {
        inflight.delete(key);
      }),
      controllers: new Set(),
    });
  }

  return fetchPromise;
}

// PUBLIC_INTERFACE
export function createRequestClient() {
  /** Returns a minimal axios-like client wrapper with dedupe/cache/abort support. */
  return {
    // PUBLIC_INTERFACE
    async get(pathOrUrl, options = {}) {
      return coreRequest('GET', pathOrUrl, options);
    },
    // PUBLIC_INTERFACE
    async post(pathOrUrl, body, options = {}) {
      return coreRequest('POST', pathOrUrl, { ...(options || {}), body });
    },
    // PUBLIC_INTERFACE
    async put(pathOrUrl, body, options = {}) {
      return coreRequest('PUT', pathOrUrl, { ...(options || {}), body });
    },
    // PUBLIC_INTERFACE
    async delete(pathOrUrl, options = {}) {
      return coreRequest('DELETE', pathOrUrl, options);
    },
    // PUBLIC_INTERFACE
    getCacheStats() {
      /** Returns basic cache statistics for debugging. */
      return { entries: cache.size, inflight: inflight.size };
    },
    // PUBLIC_INTERFACE
    clearCache() {
      /** Clears the GET cache. */
      cache.clear();
    },
  };
}

// Singleton export that other API files can reuse
// PUBLIC_INTERFACE
export const requestClient = createRequestClient();

export default requestClient;
