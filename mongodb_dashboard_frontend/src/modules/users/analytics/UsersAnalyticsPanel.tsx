import React, { useEffect, useMemo, useRef, useState } from "react";
import UsersSummaryCards from "./UsersSummaryCards";
import UsersActivityChart from "./UsersActivityChart";
import Card from "../../../components/ui/Card";
import LoadingState from "../../../components/common/LoadingState";
import ErrorState from "../../../components/common/ErrorState";
import TimeBucketFilter from "../../../components/common/TimeBucketFilter";
import Input from "../../../components/ui/Input";
import { useUsersAnalyticsData } from "../../../hooks/useUsersAnalyticsData";

/**
 * PUBLIC_INTERFACE
 * UsersAnalyticsPanel
 * Full Users Analytics tab content with Ocean Professional themed layout, filter bar,
 * refresh + auto-refresh, and resilient widget rendering.
 */
const REFRESH_INTERVAL_MS = 30000;

const UsersAnalyticsPanel: React.FC = () => {
  const [autoRefresh, setAutoRefresh] = useState(false);
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
  } = useUsersAnalyticsData({ granularity: "daily" });

  // Global manual refresh: nudge state to retrigger hook requests by toggling a hidden key
  const [refreshKey, setRefreshKey] = useState(0);
  const onRefresh = () => setRefreshKey((k) => k + 1);

  // Auto refresh
  const timerRef = useRef<number | null>(null);
  useEffect(() => {
    if (!autoRefresh) {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    timerRef.current = window.setInterval(() => onRefresh(), REFRESH_INTERVAL_MS) as unknown as number;
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [autoRefresh]);

  const kpiItems = useMemo(
    () => [
      { label: "Total Users", value: kpis.totalUsers, color: "#2563EB" },
      { label: "Active Users", value: kpis.activeUsers, color: "#3B82F6" },
      { label: "New Users", value: kpis.newUsers, color: "#60A5FA" },
      { label: "Returning Users", value: kpis.returningUsers, color: "#93C5FD" },
    ],
    [kpis]
  );

  // If error, display non-blocking toast-like message plus cards/charts empty
  const showErrorBanner = !!error;

  return (
    <div className="users-analytics ocean-pro" data-refresh-key={refreshKey}>
      <div className="ua-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>Users Analytics</h2>
          <div style={{ color: "var(--text-tertiary)", fontSize: 12 }}>Insights on user activity and growth</div>
        </div>
        <div className="toolbar">
          <button className="btn btn-ghost" onClick={onRefresh} aria-label="Refresh analytics">Refresh</button>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              aria-label="Toggle auto-refresh"
            />
            Auto refresh (30s)
          </label>
        </div>
      </div>

      <div className="ua-filters" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <TimeBucketFilter
          value={filters.granularity}
          onChange={(g) => updateFilter({ granularity: g })}
          options={[
            { label: "Daily", value: "daily" },
            { label: "Weekly", value: "weekly" },
            { label: "Monthly", value: "monthly" },
          ]}
        />
        <Input
          type="text"
          placeholder="Organization ID"
          value={filters.organization_id || ""}
          onChange={(e) => updateFilter({ organization_id: e.target.value })}
          style={{ minWidth: 180 }}
        />
        <Input
          type="text"
          placeholder="Department"
          value={filters.department || ""}
          onChange={(e) => updateFilter({ department: e.target.value })}
          style={{ minWidth: 160 }}
        />
        <Input
          type="text"
          placeholder="Status e.g. completed|active"
          value={filters.status || ""}
          onChange={(e) => updateFilter({ status: e.target.value })}
          style={{ minWidth: 220 }}
        />
        <Input
          type="text"
          placeholder="Search"
          value={(filters as any).search || ""}
          onChange={(e) => updateFilter({ search: e.target.value })}
          style={{ minWidth: 180 }}
        />
      </div>

      {showErrorBanner ? (
        <div className="ua-section" style={{ marginBottom: 12 }}>
          <Card>
            <ErrorState message={String(error)} onRetry={onRefresh} />
          </Card>
        </div>
      ) : null}

      <div className="ua-section" style={{ marginBottom: 12 }}>
        <UsersSummaryCards items={kpiItems} loading={loading} />
      </div>

      <div className="ua-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
        <Card>
          <div className="card-header">
            <div>
              <div className="card-title">Active Users Trend</div>
              <div className="card-subtitle">Unique daily/weekly active users</div>
            </div>
            <div className="card-actions">
              <button className="btn btn-ghost" onClick={onRefresh}>Refresh</button>
            </div>
          </div>
          <div className="card-content">
            {loading ? <LoadingState message="Loading trend..." height={280} /> : <UsersActivityChart data={activeTrend} />}
          </div>
        </Card>

        <Card>
          <div className="card-header">
            <div>
              <div className="card-title">New Users Over Time</div>
              <div className="card-subtitle">Signups by bucket</div>
            </div>
            <div className="card-actions">
              <button className="btn btn-ghost" onClick={onRefresh}>Refresh</button>
            </div>
          </div>
          <div className="card-content">
            {loading ? (
              <LoadingState message="Loading new users..." height={280} />
            ) : (
              <UsersActivityChart data={joinedTrend} />
            )}
          </div>
        </Card>
      </div>

      <div className="ua-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginTop: 12 }}>
        <Card>
          <div className="card-header">
            <div>
              <div className="card-title">Users by Organization</div>
              <div className="card-subtitle">Top organizations by users</div>
            </div>
            <div className="card-actions">
              <button className="btn btn-ghost" onClick={onRefresh}>Refresh</button>
            </div>
          </div>
          <div className="card-content">
            {loading ? (
              <LoadingState message="Loading organizations..." height={260} />
            ) : (byOrg && byOrg.length > 0) ? (
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                {byOrg.map((o, idx) => (
                  <li key={idx} className="hover-row" style={{ padding: "6px 4px", borderBottom: "1px solid var(--border-subtle)" }}>
                    <span>{o.organization}</span>
                    <span style={{ float: "right", fontWeight: 700 }}>{o.count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="screen-center" style={{ minHeight: 200 }}>No organization breakdown available</div>
            )}
          </div>
        </Card>

        <Card>
          <div className="card-header">
            <div>
              <div className="card-title">Users by Department</div>
              <div className="card-subtitle">Distribution by department</div>
            </div>
            <div className="card-actions">
              <button className="btn btn-ghost" onClick={onRefresh}>Refresh</button>
            </div>
          </div>
          <div className="card-content">
            {loading ? (
              <LoadingState message="Loading departments..." height={260} />
            ) : (byDept && byDept.length > 0) ? (
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                {byDept.map((d, idx) => (
                  <li key={idx} className="hover-row" style={{ padding: "6px 4px", borderBottom: "1px solid var(--border-subtle)" }}>
                    <span>{d.department}</span>
                    <span style={{ float: "right", fontWeight: 700 }}>{d.count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="screen-center" style={{ minHeight: 200 }}>No department breakdown available</div>
            )}
          </div>
        </Card>
      </div>

      {empty && !loading ? (
        <div className="ua-section" style={{ marginTop: 12 }}>
          <Card>
            <div className="screen-center" style={{ minHeight: 120 }}>
              No analytics data for the selected filters. Adjust filters to retry.
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
};

export default UsersAnalyticsPanel;
