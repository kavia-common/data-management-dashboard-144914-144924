import React from 'react';
import MostActiveUsersChart from '../components/users/MostActiveUsersChart';
import UsersList from '../components/users/UsersList';

// PUBLIC_INTERFACE
export default function UsersPage() {
  const token = window.localStorage.getItem('auth_token') || null;
  const tenantId = window.localStorage.getItem('active_tenant') || null;

  return (
    <div style={{ padding: 16, display: 'grid', gap: 16 }}>
      <MostActiveUsersChart range="30d" granularity="daily" topN={5} token={token} tenantId={tenantId} />
      <UsersList />
    </div>
  );
}
