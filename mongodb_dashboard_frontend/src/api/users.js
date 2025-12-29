import { getApiClient } from './baseClient';

/**
 * PUBLIC_INTERFACE
 * getUserBasic
 * Fetch a single user document by id from /api/users/{id}.
 * Returns the raw user document payload as { ... }.
 */
export async function getUserBasic(userId, params = {}, options = {}) {
  if (!userId) throw new Error('userId is required');
  const api = getApiClient();
  const { data } = await api.get(`/api/users/${encodeURIComponent(userId)}`, {
    params,
    signal: options.signal,
  });
  return data;
}

/**
 * Build a stable cache key for user projects requests.
 */
function buildProjectsKey(userId, params = {}) {
  const { organization_id, tenant_id, from, to } = params || {};
  const org = organization_id || tenant_id || '';
  return JSON.stringify({
    userId: String(userId || ''),
    organization_id: String(org || ''),
    from: from ? String(from) : '',
    to: to ? String(to) : '',
  });
}

// In-flight de-duplication map: key -> { promise, abortController }
const inflightProjects = new Map();

/**
 * PUBLIC_INTERFACE
 * getUserProjects
 * Fetch distinct projects for a given user from session tracking aggregation.
 * Accepts a params object that can carry tenant scoping and optional time range:
 * { organization_id?: string, tenant_id?: string, from?: string, to?: string }
 *
 * Options:
 * - signal?: AbortSignal  // optional external signal; when aborted, request will abort but cache entry is cleaned safely
 * - cancelPrevious?: boolean // when true, cancels any in-flight request for the same key before starting a new one
 */
export async function getUserProjects(userId, params = {}, options = {}) {
  if (!userId) throw new Error('userId is required');
  const key = buildProjectsKey(userId, params);
  const { signal: externalSignal, cancelPrevious = false } = options || {};

  // Cancel an older in-flight for this key when explicitly requested (e.g., selection changed quickly)
  if (cancelPrevious && inflightProjects.has(key)) {
    try {
      inflightProjects.get(key)?.abortController?.abort();
    } catch {
      // ignore
    } finally {
      inflightProjects.delete(key);
    }
  }

  // If a request for the same key is already in flight, return the same promise (de-dup)
  if (inflightProjects.has(key)) {
    return inflightProjects.get(key).promise;
  }

  const api = getApiClient();

  // Compose an AbortController that respects external aborts
  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }

  const promise = (async () => {
    try {
      const { data } = await api.get(`/api/users/${encodeURIComponent(userId)}/projects`, {
        params,
        signal: controller.signal,
      });
      return data;
    } finally {
      // Clean up event listener and inflight map
      if (externalSignal) {
        try {
          externalSignal.removeEventListener('abort', onExternalAbort);
        } catch {
          // ignore
        }
      }
      inflightProjects.delete(key);
    }
  })();

  inflightProjects.set(key, { promise, abortController: controller });
  return promise;
}

/**
 * PUBLIC_INTERFACE
 * cancelUserProjectsRequest
 * Cancels an in-flight user projects request matching the provided key params.
 */
export function cancelUserProjectsRequest(userId, params = {}) {
  const key = buildProjectsKey(userId, params);
  const entry = inflightProjects.get(key);
  if (entry?.abortController) {
    try {
      entry.abortController.abort();
    } catch {
      // ignore
    } finally {
      inflightProjects.delete(key);
    }
  }
}
