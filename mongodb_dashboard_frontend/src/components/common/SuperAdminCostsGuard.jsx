import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * PUBLIC_INTERFACE
 * SuperAdminCostsGuard
 * A minimal route guard for the Costs module.
 * Allows access only when active tenant/organization id === "T0000".
 * Name is NOT required.
 *
 * Otherwise, redirects to /dashboard/overview.
 */
export default function SuperAdminCostsGuard({ children }) {
  const location = useLocation();
  const { activeOrganization, activeTenant, user, getActiveOrganization } = useAuth?.() || {};

  // Derive org/tenant id from multiple possible sources
  const orgId =
    (activeOrganization && (activeOrganization.id || activeOrganization.organization_id || activeOrganization.tenant_id)) ||
    (activeTenant && (activeTenant.id || activeTenant.organization_id || activeTenant.tenant_id)) ||
    (typeof getActiveOrganization === 'function' ? getActiveOrganization() : null) ||
    (user && (user.organization_id || user.tenant_id)) ||
    null;

  const isSuperAdminOrg = String(orgId || '').trim() === 'T0000';

  if (!isSuperAdminOrg) {
    // Redirect non-authorized users to the overview
    return <Navigate to="/dashboard/overview" state={{ from: location }} replace />;
  }

  return children;
}
