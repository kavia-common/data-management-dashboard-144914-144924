import React from 'react';
import UsersSignupBarChart from '../components/dashboard/UsersSignupBarChart';

/**
 * PUBLIC_INTERFACE
 * DashboardOverview
 * Adds UsersSignupBarChart with default daily range.
 */
export default function DashboardOverview() {
  return (
    <div style={{ padding: 16 }}>
      <UsersSignupBarChart />
    </div>
  );
}
