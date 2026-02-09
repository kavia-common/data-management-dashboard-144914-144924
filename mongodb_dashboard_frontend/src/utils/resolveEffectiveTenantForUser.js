import { isSuperAdmin } from './isSuperAdmin';

/**
 * PUBLIC_INTERFACE
 * resolveEffectiveTenantForUser
 * Resolve which tenant/organization id should be used to fetch tenant-scoped data
 * for a selected user.
 *
 * Background:
 * - Most endpoints in this dashboard are tenant-scoped.
 * - When logged in as Super Admin (tenant T0000), the *active* tenant id may be
 *   T0000 while the selected user belongs to some other tenant (e.g. T0015).
 * - In that case, fetching session details / costs / session-tracking scoped to
 *   T0000 returns empty data for that user.
 *
 * Rule:
 * - If currentOrgId is NOT super admin: use currentOrgId (normal behavior).
 * - If currentOrgId IS super admin (T0000): prefer the selected user's own
 *   tenant/organization id when present; fall back to currentOrgId if missing.
 *
 * @param {Object|null|undefined} user - selected user object
 * @param {string|null|undefined} currentOrgId - active tenant/org id from auth context
 * @returns {string|null} effective tenant/org id to use for tenant-scoped requests
 */
export function resolveEffectiveTenantForUser(user, currentOrgId) {
  const active = currentOrgId ? String(currentOrgId) : null;

  // Normal tenants: keep existing behavior
  if (active && !isSuperAdmin(active)) return active;

  // Super admin: attempt to scope to selected user's tenant
  const userTenantRaw =
    user?.tenant_id ||
    user?.organization_id ||
    user?.tenantId ||
    user?.organizationId ||
    null;

  const userTenant = userTenantRaw ? String(userTenantRaw) : null;
  return userTenant || active || null;
}
