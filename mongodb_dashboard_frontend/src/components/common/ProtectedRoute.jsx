import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isSuperAdmin } from '../../utils/isSuperAdmin';

/**
 * PUBLIC_INTERFACE
 * ProtectedRoute guards routes that require authentication and can optionally enforce super-admin restriction.
 * If unauthenticated, redirects to /login and preserves the original path in state.
 *
 * Props (via element usage with React Router v6):
 * - superAdminOnly?: boolean — when true, only allow users whose organization_id/tenant_id === 'T0000'
 *
 * Usage:
 *   <Route element={<ProtectedRoute />}> ... </Route>
 *   <Route path="/dashboard/costs" element={<ProtectedRoute superAdminOnly />} />
 */
export default function ProtectedRoute({ superAdminOnly = false }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (superAdminOnly && !isSuperAdmin(user)) {
    // Redirect non-super-admins to a safe page
    return <Navigate to="/dashboard/overview" replace />;
  }

  return <Outlet />;
}
