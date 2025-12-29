export { getApiClient, listUsers, listSessions, listDeployments, listLlmCosts, listLlmCostsUnderscore, health, getTenantUsersSummaryStrict } from './baseClient';
export * from './baseClient';
export * from './modulesClient';
export * from './util';
export { getUserProjects, getUserBasic } from './users';
export { fetchUsersMetrics } from './users.metrics';

// Re-export session tracking named fetcher for direct imports when needed
export { fetchSessionTracking } from './sessionTracking';

// Back-compat alias: listSessions should point to baseClient.listSessions which already calls /api/session-tracking
// If other modules import fetchSessionTracking directly, they can do so via the export above.
