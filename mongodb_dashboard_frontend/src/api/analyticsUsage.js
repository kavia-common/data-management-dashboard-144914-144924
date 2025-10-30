import baseClient from './baseClient';
import { buildQueryString } from './util';

/**
 * Helper to construct query params honoring shared filters.
 * Accepts: { from, to, tenant_id, project_id, status, limit }
 */
const withFilters = (params = {}) => {
  const { from, to, tenant_id, project_id, status, limit } = params;
  const query = {};
  if (from) query.from = from;
  if (to) query.to = to;
  if (tenant_id) query.tenant_id = tenant_id;
  if (project_id) query.project_id = project_id;
  if (status) query.status = status;
  if (limit) query.limit = limit;
  return query;
};

// PUBLIC_INTERFACE
export async function getGroupByAgents(params = {}) {
  /** Fetch analytics grouped by agents. */
  const qs = buildQueryString(withFilters(params));
  const { data } = await baseClient.get(`/api/analytics/group-by-agents${qs}`);
  return data;
}

// PUBLIC_INTERFACE
export async function getGroupByTeams(params = {}) {
  /** Fetch analytics grouped by teams. */
  const qs = buildQueryString(withFilters(params));
  const { data } = await baseClient.get(`/api/analytics/group-by-teams${qs}`);
  return data;
}

// PUBLIC_INTERFACE
export async function getUsageByUser(params = {}) {
  /** Fetch usage aggregated by user. */
  const qs = buildQueryString(withFilters(params));
  const { data } = await baseClient.get(`/api/analytics/usage-by-user${qs}`);
  return data;
}

// PUBLIC_INTERFACE
export async function getFeaturesByCredit(params = {}) {
  /** Fetch features by credit usage (supports most/least via limit/sort server-side). */
  const qs = buildQueryString(withFilters(params));
  const { data } = await baseClient.get(`/api/analytics/features-by-credit${qs}`);
  return data;
}

export default {
  getGroupByAgents,
  getGroupByTeams,
  getUsageByUser,
  getFeaturesByCredit,
};
