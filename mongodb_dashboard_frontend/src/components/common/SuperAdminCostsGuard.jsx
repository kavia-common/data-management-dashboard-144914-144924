import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * PUBLIC_INTERFACE
 * SuperAdminCostsGuard
 * A minimal route guard for the Costs module.
 * Allows access only when both:
 *  - active tenant/organization id === "T0000"
 *  - active tenant/organization name === "Super Admin"
 *
 * Otherwise, redirects to /dashboard/overview.
 */
export default function SuperAdminCostsGuard({ children }) {
  const location = useLocation();
  const { activeOrganization, activeTenant, user, getActiveOrganization, getActiveTenantName } = useAuth?.() || {};

  // Try to derive org id and name from multiple possible sources
  const orgId =
    (activeOrganization && (activeOrganization.id || activeOrganization.organization_id || activeOrganization.tenant_id)) ||
    (activeTenant && (activeTenant.id || activeTenant.organization_id || activeTenant.tenant_id)) ||
    (typeof getActiveOrganization === 'function' ? getActiveOrganization() : null) ||
    (user && (user.organization_id || user.tenant_id)) ||
    null;

  const orgName =
    (activeOrganization && (activeOrganization.name || activeOrganization.tenant_name)) ||
    (activeTenant && (activeTenant.name || activeTenant.tenant_name)) ||
    (typeof getActiveTenantName === 'function' ? getActiveTenantName() : null) ||
    (user && (user.tenant_name || user.organization_name || user.tenant?.name)) ||
    null;

  const isSuperAdmin = orgId === 'T0000' && orgName === 'Super Admin';

  if (!isSuperAdmin) {
    // Redirect non-authorized users to the overview
    return <Navigate to="/dashboard/overview" state={{ from: location }} replace />;
  }

  return children;
}
