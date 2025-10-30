import React, { useMemo, useState } from 'react';
import './UserInsights.css';
import KpiCards from '../../components/users/KpiCards';
import UsersEngagementAreaChart from '../../components/users/UsersEngagementAreaChart';
import UsersDepartmentBarChart from '../../components/users/UsersDepartmentBarChart';
import UsersOrganizationPieChart from '../../components/users/UsersOrganizationPieChart';
import ComplianceDonutChart from '../../components/users/ComplianceDonutChart';

import useUserTrends from '../../hooks/useUserTrends';
import useActiveUsersByDepartment from '../../hooks/useActiveUsersByDepartment';
import useActiveUsersByOrganization from '../../hooks/useActiveUsersByOrganization';
import useUserCompliance from '../../hooks/useUserCompliance';
import useActiveUsers from '../../hooks/useActiveUsers';
import useProjectUsage from '../../hooks/useProjectUsage'; // not directly used but available
import useDebouncedValue from '../../hooks/useDebouncedValue';

// PUBLIC_INTERFACE
export default function UserInsights() {
  /**
   * User Insights dashboard page.
   * Includes:
   * - Period switcher for KPIs (daily/weekly/monthly)
   * - Optional date range filter (from/to)
   * - Engagement area chart (users & sessions)
   * - Group charts (departments, organizations)
   * - Compliance donut
   */
  const [period, setPeriod] = useState('daily');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const debouncedFrom = useDebouncedValue(from, 300);
  const debouncedTo = useDebouncedValue(to, 300);

  // Time window derived when user provides from/to; hooks generally accept { from, to, granularity }
  const granularity = useMemo(() => {
    if (period === 'daily') return 'day';
    if (period === 'weekly') return 'week';
    if (period === 'monthly') return 'month';
    return 'day';
  }, [period]);

  // Hooks
  const { data: kpiData, loading: kpiLoading } = useActiveUsers({
    period, // this hook is expected to call /api/users/activity or kpis equivalents based on README
  });

  const { data: trendData, loading: trendLoading } = useUserTrends({
    granularity,
    from: debouncedFrom || undefined,
    to: debouncedTo || undefined,
  });

  const { data: deptData, loading: deptLoading } = useActiveUsersByDepartment({
    from: debouncedFrom || undefined,
    to: debouncedTo || undefined,
  });

  const { data: orgData, loading: orgLoading } = useActiveUsersByOrganization({
    from: debouncedFrom || undefined,
    to: debouncedTo || undefined,
  });

  const { data: complianceData, loading: complianceLoading } = useUserCompliance({
    from: debouncedFrom || undefined,
    to: debouncedTo || undefined,
  });

  const kpis = useMemo(() => {
    // If useActiveUsers returns ActivityResponse shape, wrap it as KPIs-compat
    // We'll map activeUsers into totals.activeUsers, others may be missing which KpiCards handles.
    if (!kpiData) return { totals: {} };
    if (kpiData?.totals) return kpiData;
    // Fallback: assume it's a number
    return { totals: { activeUsers: Number(kpiData) || 0 } };
  }, [kpiData]);

  return (
    <div className="user-insights-page">
      <div className="user-insights-header">
        <h1>User Insights</h1>
        <div className="filters">
          <div className="period-switch">
            {['daily', 'weekly', 'monthly'].map((p) => (
              <button
                key={p}
                className={`period-btn ${period === p ? 'active' : ''}`}
                onClick={() => setPeriod(p)}
              >
                {capitalize(p)}
              </button>
            ))}
          </div>
          <div className="date-range">
            <label>
              From
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label>
              To
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
          </div>
        </div>
      </div>

      <KpiCards kpis={kpis} period={period} loading={kpiLoading} />

      <div className="grid-2">
        <UsersEngagementAreaChart data={trendData?.items || []} loading={trendLoading} />
        <ComplianceDonutChart
          totals={complianceData?.totals}
          items={complianceData?.items}
          loading={complianceLoading}
        />
      </div>

      <div className="grid-2">
        <UsersDepartmentBarChart data={deptData?.items || deptData || []} loading={deptLoading} />
        <UsersOrganizationPieChart data={orgData?.items || orgData || []} loading={orgLoading} />
      </div>
    </div>
  );
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
