export const SUPER_ADMIN_ORG_ID = 'T0000';

/**
 * PUBLIC_INTERFACE
 * isSuperAdmin
 * Determines if the provided user or org id corresponds to the super admin tenant.
 *
 * Accepts either:
 *  - a user object with organization_id or tenant_id
 *  - a string representing organization/tenant id
 *
 * Returns true only when the effective org id equals 'T0000'.
 */
export function isSuperAdmin(input) {
  // Support both user object and direct string id
  const orgId = typeof input === 'string'
    ? input
    : input?.organization_id || input?.tenant_id || input?.orgId || input?.tenantId;

  return orgId === SUPER_ADMIN_ORG_ID;
}
