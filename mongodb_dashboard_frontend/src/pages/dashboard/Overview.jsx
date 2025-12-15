import React, { useEffect, useState } from "react";
import Card from "../../components/ui/Card.jsx";
import Skeleton from "../../components/ui/Skeleton.jsx";
import { listUsers, listSessions, listDeployments, health } from "../../api";
import { OverviewUsersSummarySection } from "../../components/overview";
import SessionsPerDayBarChart from "../../components/charts/SessionsPerDayBarChart.jsx";

/**
 * PUBLIC_INTERFACE
 * Overview page
 * - Shows KPI cards and the new Users Summary section with time-range filters.
 */
export default function Overview() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({ users: 0, sessions: 0, deployments: 0 });
  const [error, setError] = useState("");
  const [, setApiStatus] = useState("checking");

  // KPI metrics
  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      setLoading(true);
      setError("");
      try {
        const [usersRes, sessionsRes, deploymentsRes] = await Promise.all([
          listUsers({ limit: 5 }),
          listSessions({ limit: 5 }),
          listDeployments({ limit: 5 }),
        ]);
        if (cancelled) return;
        setMetrics({
          users: usersRes?.total || usersRes?.length || usersRes?.items?.length || 0,
          sessions: sessionsRes?.total || sessionsRes?.length || sessionsRes?.items?.length || 0,
          deployments: deploymentsRes?.total || deploymentsRes?.length || deploymentsRes?.items?.length || 0,
        });
      } catch (e) {
        if (!cancelled) {
          setError(e?.response?.data?.message || e?.message || "Failed to load overview data.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  // Backend health check (non-blocking)
  useEffect(() => {
    let mounted = true;
    async function ping() {
      try {
        const info = await health();
        if (!mounted) return;
        setApiStatus(info ? "ok" : "error");
      } catch {
        if (!mounted) return;
        setApiStatus("error");
      }
    }
    ping();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="grid">
      <Card title="Users" subtitle="Total referral users" className="kpi-card">
        <div className="kpi">
          <div className="kpi-value">
            {loading ? (
              <Skeleton width={72} height={28} aria-label="Loading users metric" />
            ) : (
              metrics.users
            )}
          </div>
          <div className="kpi-label">Users</div>
        </div>
      </Card>

      <Card title="Sessions" subtitle="Active and historical sessions" className="kpi-card">
        <div className="kpi">
          <div className="kpi-value">
            {loading ? (
              <Skeleton width={72} height={28} aria-label="Loading sessions metric" />
            ) : (
              metrics.sessions
            )}
          </div>
          <div className="kpi-label">Sessions</div>
        </div>
      </Card>

      <Card title="Deployments" subtitle="Recent app deployments" className="kpi-card">
        <div className="kpi">
          <div className="kpi-value">
            {loading ? (
              <Skeleton width={72} height={28} aria-label="Loading deployments metric" />
            ) : (
              metrics.deployments
            )}
          </div>
          <div className="kpi-label">Deployments</div>
        </div>
      </Card>

      {error && (
        <div className="block-full" role="alert" style={{ alignSelf: "start" }}>
          <div className="error">{error}</div>
        </div>
      )}

      {/* Existing Sessions Created chart */}
      {/* <div className="block-full" style={{ alignSelf: "stretch" }}>
        <Card title="Sessions Created">
          <SessionsPerDayBarChart />
        </Card>
      </div> */}



      {/* Existing Users Summary section */}
      <div className="block-full" style={{ alignSelf: "stretch" }}>
        <OverviewUsersSummarySection defaultRange="daily" />
      </div>
    </div>
  );
}
