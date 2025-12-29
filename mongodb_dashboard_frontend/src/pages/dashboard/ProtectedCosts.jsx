import React from 'react';
import ProtectedRoute from '../../components/common/ProtectedRoute';
import Costs from './Costs';

/**
 * PUBLIC_INTERFACE
 * ProtectedCosts
 * A thin wrapper around the Costs page that applies super-admin-only protection.
 * Non-T0000 users are redirected to /dashboard.
 */
const ProtectedCosts = () => {
  return (
    <ProtectedRoute superAdminOnly>
      <Costs />
    </ProtectedRoute>
  );
};

export default ProtectedCosts;
