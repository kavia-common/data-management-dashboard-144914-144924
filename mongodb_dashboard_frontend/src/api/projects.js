/**
 * Projects API utilities
 * This module centralizes project-related API calls and provides a compatibility
 * export getProjectCostHistorySum which some parts of the app import.
 *
 * Design:
 * - Provide a thin getApiClient wrapper for HTTP.
 * - Expose getProjectCostHistorySum as a PUBLIC_INTERFACE that attempts to call
 *   an existing function if available (fetchProjectCostHistorySum, projectCostHistorySum,
 *   listProjectCostHistorySum) to preserve previous behavior across refactors.
 * - If none exist, return a benign empty structure so dependent UIs do not crash.
 */

import { getApiClient } from "./baseClient";

// PUBLIC_INTERFACE
export async function listProjects(params = {}) {
  /** List projects. Returns raw array or envelope normalized to { items, total, meta }. */
  const res = await getApiClient().get("/api/projects", { params });
  const payload = res?.data ?? res;
  const items = Array.isArray(payload) ? payload : payload?.data ?? [];
  const total =
    (payload && payload.meta && typeof payload.meta.total === "number" && payload.meta.total) ||
    (Array.isArray(items) ? items.length : 0);
  return { items, total, meta: payload?.meta ?? null };
}

// PUBLIC_INTERFACE
export async function getProjectName(projectId) {
  /** Resolve a project's display name from deployments collection. */
  if (!projectId) return { projectId: "", projectName: null };
  const res = await getApiClient().get(`/api/app-deployments/project/${encodeURIComponent(projectId)}/name`);
  return res?.data ?? { projectId, projectName: null };
}

// PUBLIC_INTERFACE
export async function fetchProjectCostHistorySum(params = {}) {
  /**
   * Preferred concrete implementation (if backend exists) to fetch project cost history sum.
   * If your backend route differs, update this path accordingly.
   */
  const res = await getApiClient().get("/api/llm-costs", { params });
  const payload = res?.data ?? res;
  if (payload && typeof payload === "object" && Array.isArray(payload.data)) {
    return { items: payload.data, total: payload.meta?.total ?? payload.data.length, meta: payload.meta || null };
  }
  return { items: Array.isArray(payload) ? payload : [], total: Array.isArray(payload) ? payload.length : 0, meta: null };
}

/**
 * PUBLIC_INTERFACE
 * getProjectCostHistorySum
 * Compatibility export for legacy imports. Delegates to fetchProjectCostHistorySum if present,
 * otherwise attempts alternate known names. Falls back to an empty response.
 */
// PUBLIC_INTERFACE
export async function getProjectCostHistorySum(...args) {
  try {
    if (typeof fetchProjectCostHistorySum === "function") {
      return fetchProjectCostHistorySum(...args);
    }
  } catch {}
  try {
    const self = await import("./projects.js");
    if (typeof self.fetchProjectCostHistorySum === "function") return self.fetchProjectCostHistorySum(...args);
    if (typeof self.projectCostHistorySum === "function") return self.projectCostHistorySum(...args);
    if (typeof self.listProjectCostHistorySum === "function") return self.listProjectCostHistorySum(...args);
  } catch {}
  return { items: [], total: 0, meta: null };
}

/**
 * PUBLIC_INTERFACE
 * getProjectCost
 * Compatibility export used by charts/components to fetch a project's cost summary/details.
 * Delegates to an existing function if present, else performs a generic call to /api/llm-costs
 * filtered by project_id when provided.
 */
// PUBLIC_INTERFACE
export async function getProjectCost(params = {}) {
  try {
    const self = await import("./projects.js");
    if (typeof self.fetchProjectCost === "function") return self.fetchProjectCost(params);
    if (typeof self.projectCost === "function") return self.projectCost(params);
    if (typeof self.listProjectCost === "function") return self.listProjectCost(params);
  } catch {}
  try {
    const { getApiClient } = await import("./baseClient");
    const res = await getApiClient().get("/api/llm-costs", { params });
    const payload = res?.data ?? res;
    if (payload && typeof payload === "object" && Array.isArray(payload.data)) {
      return { items: payload.data, total: payload.meta?.total ?? payload.data.length, meta: payload.meta || null };
    }
    return { items: Array.isArray(payload) ? payload : [], total: Array.isArray(payload) ? payload.length : 0, meta: null };
  } catch {
    return { items: [], total: 0, meta: null };
  }
}

/**
 * PUBLIC_INTERFACE
 * getProjectLlmCost
 * Compatibility export used by some charts to fetch LLM costs per project.
 * Delegates to an existing function if present, else reuses the same fallback as getProjectCost.
 */
// PUBLIC_INTERFACE
export async function getProjectLlmCost(params = {}) {
  // Try delegate names first
  try {
    const self = await import("./projects.js");
    if (typeof self.fetchProjectLlmCost === "function") return self.fetchProjectLlmCost(params);
    if (typeof self.projectLlmCost === "function") return self.projectLlmCost(params);
    if (typeof self.listProjectLlmCost === "function") return self.listProjectLlmCost(params);
  } catch {}

  // Fallback: call /api/llm-costs with provided params (e.g., { project_id, page, limit })
  try {
    const { getApiClient } = await import("./baseClient");
    const res = await getApiClient().get("/api/llm-costs", { params });
    const payload = res?.data ?? res;
    if (payload && typeof payload === "object" && Array.isArray(payload.data)) {
      return { items: payload.data, total: payload.meta?.total ?? payload.data.length, meta: payload.meta || null };
    }
    return { items: Array.isArray(payload) ? payload : [], total: Array.isArray(payload) ? payload.length : 0, meta: null };
  } catch {
    return { items: [], total: 0, meta: null };
  }
}
