import React, { useEffect, useMemo, useState } from "react";
import UsersByTenantChart from "../../../components/charts/UsersByTenantChart.jsx";
import ActiveUsersTrendChart from "../../../components/charts/ActiveUsersTrendChart.jsx";
import Card from "../../../components/common/Card.jsx";
import LoadingState from "../../../components/common/LoadingState.jsx";
import ErrorState from "../../../components/common/ErrorState.jsx";
import { fetchActiveTrend, fetchUsersByOrganization } from "../../../api/usersAnalytics";

function useDateRange(defaultDays = 30) {
  const [rangeDays, setRangeDays] = useState(defaultDays);
  const { fromIso, toIso } = useMemo(() => {
    const now = new Date();
    const from = new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000);
    return { fromIso: from.toISOString(), toIso: now.toISOString() };
  }, [rangeDays]);
  return { rangeDays, setRangeDays, fromIso, toIso };
}

/**
 * PUBLIC_INTERFACE
 * UsersAnalyticsPanel
 * Renders analytics visualizations for Users area using existing chart components.
 */
export default function UsersAnalyticsPanel() {
  const { rangeDays, setRangeDays, fromIso, toIso } = useDateRange(30);

  const [trendLoading, setTrendLoading] = useState(false);
  const [trendError, setTrendError] = useState(null);
  const [trendItems, setTrendItems] = useState([]);

  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(null);
  const [summaryItems, setSummaryItems] = useState([]);

  useEffect(() => {
    let mounted = true;
    async function loadTrend() {
      setTrendLoading(true);
      setTrendError(null);
      try {
        const resp = await fetchActiveTrend({ startDate: fromIso, endDate: toIso, granularity: "day", status: "completed|active" });
        if (!mounted) return;
        const items = Array.isArray(resp?.items) ? resp.items : (Array.isArray(resp) ? resp : []);
        setTrendItems(items);
      } catch (e) {
        if (!mounted) return;
        setTrendError(e?.message || "Failed to load active users trend");
        setTrendItems([]);
      } finally {
        if (mounted) setTrendLoading(false);
      }
    }
    loadTrend();
    return () => { mounted = false; };
  }, [fromIso, toIso]);

  useEffect(() => {
    let mounted = true;
    async function loadSummary() {
      setSummaryLoading(true);
      setSummaryError(null);
      try {
        const items = await fetchUsersByOrganization({ from: fromIso, to: toIso, includeInactive: false });
        if (!mounted) return;
        // items: [{ organization, count }]
        setSummaryItems(items);
      } catch (e) {
        if (!mounted) return;
        setSummaryError(e?.message || "Failed to load users summary");
        setSummaryItems([]);
      } finally {
        if (mounted) setSummaryLoading(false);
      }
    }
    loadSummary();
    return () => { mounted = false; };
  }, [fromIso, toIso]);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <h2 style={{ margin: 0, color: "#111827" }}>Users Analytics</h2>
        <div style={{ marginLeft: "auto" }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "#6B7280" }}>Date range</span>
            <select
              aria-label="Date range"
              value={rangeDays}
              onChange={(e) => setRangeDays(Number(e.target.value))}
              className="ui-input"
              style={{ minWidth: 160 }}
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </label>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
        <Card title="Active Users Trend" subtitle="Distinct daily active users">
          {trendLoading ? (
            <LoadingState message="Loading trend..." />
          ) : trendError ? (
            <ErrorState message={trendError} />
          ) : (
            <ActiveUsersTrendChart data={trendItems} />
          )}
        </Card>

        <Card title="Users by Tenant" subtitle="Distinct active users by tenant">
          {summaryLoading ? (
            <LoadingState message="Loading summary..." />
          ) : summaryError ? (
            <ErrorState message={summaryError} />
          ) : (
            <UsersByTenantChart
              from={fromIso}
              to={toIso}
              status={"completed|active"}
              includeInactive={false}
              maxBars={12}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
