import React, { useMemo } from 'react';
import './analytics.css';
import Card from '../../components/ui/Card';
import Skeleton from '../../components/ui/Skeleton';
import ErrorState from '../../components/common/ErrorState';
import LoadingState from '../../components/common/LoadingState';
import { useUsersAnalyticsData } from '../../hooks/useUsersAnalyticsData';
import KPIChart from '../../components/charts/KPIChart';
import ActiveUsersTrendChart from '../../components/charts/ActiveUsersTrendChart';
import UsersByTenantChart from '../../components/charts/UsersByTenantChart';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import TimeBucketFilter from '../../components/common/TimeBucketFilter';
import Input from '../../components/ui/Input';

const COLORS = ['#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#1D4ED8', '#1E40AF', '#0EA5E9', '#38BDF8'];

const UsersAnalytics = () => {
  const {
    filters,
    updateFilter,
    loading,
    error,
    empty,
    kpis,
    activeTrend,
    joinedTrend,
    byDept,
    byOrg,
  } = useUsersAnalyticsData({
    granularity: 'daily',
  });

  const kpiItems = useMemo(() => ([
    { label: 'Total Users', value: kpis.totalUsers, color: '#2563EB' },
    { label: 'Active Users', value: kpis.activeUsers, color: '#3B82F6' },
    { label: 'New Users', value: kpis.newUsers, color: '#60A5FA' },
    { label: 'Returning Users', value: kpis.returningUsers, color: '#93C5FD' },
  ]), [kpis]);

  return (
    <div className="users-analytics ocean-pro">
      <div className="ua-header">
        <h2>Users Analytics</h2>
        <div className="ua-filters">
          <TimeBucketFilter
            value={filters.granularity}
            onChange={(g) => updateFilter({ granularity: g })}
            options={[
              { label: 'Daily', value: 'daily' },
              { label: 'Weekly', value: 'weekly' },
              { label: 'Monthly', value: 'monthly' },
            ]}
          />
          <Input
            type="text"
            placeholder="Department"
            value={filters.department || ''}
            onChange={(e) => updateFilter({ department: e.target.value })}
            style={{ minWidth: 180 }}
          />
          <Input
            type="text"
            placeholder="Organization ID"
            value={filters.organization_id || ''}
            onChange={(e) => updateFilter({ organization_id: e.target.value })}
            style={{ minWidth: 180 }}
          />
          <Input
            type="text"
            placeholder="Status e.g. completed|active"
            value={filters.status || ''}
            onChange={(e) => updateFilter({ status: e.target.value })}
            style={{ minWidth: 220 }}
          />
        </div>
      </div>

      {loading && (
        <div className="ua-section">
          <Card>
            <LoadingState title="Loading analytics" subtitle="Fetching latest metrics and charts..." />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 16 }}>
              {[...Array(4)].map((_, i) => <Skeleton key={i} height={80} />)}
            </div>
            <Skeleton height={300} style={{ marginTop: 16 }} />
          </Card>
        </div>
      )}

      {error && !loading && (
        <div className="ua-section">
          <Card>
            <ErrorState title="Unable to load analytics" message={error} />
          </Card>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="ua-section">
            <Card>
              <KPIChart items={kpiItems} />
            </Card>
          </div>

          {empty ? (
            <div className="ua-section">
              <Card>
                <ErrorState
                  title="No analytics data"
                  message="We couldn't find analytics data for the selected filters. Try adjusting the time range or filters."
                />
              </Card>
            </div>
          ) : (
            <>
              <div className="ua-grid">
                <Card>
                  <h3 className="ua-card-title">Active Users Trend</h3>
                  <div style={{ width: '100%', height: 300 }}>
                    <ActiveUsersTrendChart data={activeTrend} />
                  </div>
                </Card>

                <Card>
                  <h3 className="ua-card-title">New Users Over Time</h3>
                  <div style={{ width: '100%', height: 300 }}>
                    <ResponsiveContainer>
                      <BarChart data={joinedTrend}>
                        <XAxis dataKey="date" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="total" name="New Users" fill="#60A5FA" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>

              <div className="ua-grid">
                <Card>
                  <h3 className="ua-card-title">Users by Organization</h3>
                  <div style={{ width: '100%', height: 300 }}>
                    <UsersByTenantChart data={byOrg.map(d => ({ tenant: d.organization, total: d.count }))} />
                  </div>
                </Card>

                <Card>
                  <h3 className="ua-card-title">Users by Department</h3>
                  <div style={{ width: '100%', height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={byDept}
                          dataKey="count"
                          nameKey="department"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          fill="#2563EB"
                          label
                        >
                          {byDept.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default UsersAnalytics;
