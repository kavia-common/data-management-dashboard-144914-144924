import React, { useEffect, useMemo, useState } from "react";
import Card from "../../components/ui/Card.jsx";
import KPIChart from "../../components/charts/KPIChart.jsx";
import Skeleton from "../../components/ui/Skeleton.jsx";
import Button from "../../components/ui/Button.jsx";
import { listUsers, listSessions, listDeployments, health } from "../../api";
import { getAgentsAnalytics } from "../../api/agentsAnalytics";
import LoadingState from "../../components/common/LoadingState.jsx";
import ErrorState from "../../components/common/ErrorState.jsx";
import AgentsBar from "../../components/charts/AgentCostBarChart.jsx";
import AgentsTable from "../../components/tables/AgentsUsageTable.jsx";

// PUBLIC_INTERFACE
export default function Overview() {
  /** Overview page with basic metrics and activity trends. */
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({ users: 0, sessions: 0, deployments: 0 });
  const [trend, setTrend] = useState([]);
  const [error, setError] = useState("");
  const [apiStatus, setApiStatus] = useState("checking");

  // Agents section state
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [agentsError, setAgentsError] = useState("");
  const [agentsItems, setAgentsItems] = useState([]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError("");
      try {
        const [users, sessions, deployments] = await Promise.all([
          listUsers({ limit: 5 }),
          listSessions({ limit: 5 }),
          listDeployments({ limit: 5 }),
        ]);
        setMetrics({
          users: (users?.total || users?.length || 0),
          sessions: (sessions?.total || sessions?.length || 0),
          deployments: (deployments?.total || deployments?.length || 0),
        });
        const t = [
          { label: "Mon", value: (users?.length || 1) * 1 },
          { label: "Tue", value: (sessions?.length || 2) * 2 },
          { label: "Wed", value: (deployments?.length || 3) * 3 },
          { label: "Thu", value: (users?.length || 2) * 2 },
          { label: "Fri", value: (sessions?.length || 1) * 1 },
          { label: "Sat", value: (deployments?.length || 1) * 1 },
          { label: "Sun", value: (users?.length || 1) + (sessions?.length || 1) },
        ];
        setTrend(t);
      } catch (e) {
        setError(e?.response?.data?.message || e?.message || "Failed to load overview data.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

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

  // Fetch Agents analytics (defaults: last 30 days top 10)
  useEffect(() => {
    let cancelled = false;
    async function loadAgents() {
      setAgentsLoading(true);
      setAgentsError("");
      try {
        const now = new Date();
        const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const to = now.toISOString();
        const { items } = await getAgentsAnalytics({ limit: 10, from, to, grouping: 'department' });
        if (!cancelled) {
          setAgentsItems(items || []);
        }
      } catch (e) {
        if (!cancelled) {
          setAgentsError(e?.message || "Failed to load agents analytics.");
        }
      } finally {
        if (!cancelled) setAgentsLoading(false);
      }
    }
    loadAgents();
    return () => {
      cancelled = true;
    };
  }, []);

  const compactChartItems = useMemo(() => {
    // Normalize for chart component signature
    const mapped = (agentsItems || []).map((it) => ({
      agent_name: it.agent_name || it.agent,
      total_cost: Number(it.total_cost || 0),
    }));
    // top-N already limited by API; keep as-is
    return mapped;
  }, [agentsItems]);

  const compactTableItems = useMemo(() => {
    // Reuse same items; table will handle sorting and display minimal columns
    return (agentsItems || []).slice(0, 10);
  }, [agentsItems]);

  return (
    <div className="grid">
      {/* KPI cards row — responsive spans handled by .kpi-card rules in App.css */}
      <Card title="Users" subtitle="Total referral users" className="kpi-card">
        <div className="kpi">
          <div className="kpi-value">
            {loading ? <Skeleton width={72} height={28} aria-label="Loading users metric" /> : metrics.users}
          </div>
          <div className="kpi-label">Users</div>
        </div>
      </Card>
      <Card title="Sessions" subtitle="Active and historical sessions" className="kpi-card">
        <div className="kpi">
          <div className="kpi-value">
            {loading ? <Skeleton width={72} height={28} aria-label="Loading sessions metric" /> : metrics.sessions}
          </div>
          <div className="kpi-label">Sessions</div>
        </div>
      </Card>
      <Card title="Deployments" subtitle="Recent app deployments" className="kpi-card">
        <div className="kpi">
          <div className="kpi-value">
            {loading ? <Skeleton width={72} height={28} aria-label="Loading deployments metric" /> : metrics.deployments}
          </div>
          <div className="kpi-label">Deployments</div>
        </div>
      </Card>

      {/* Agents group-by section */}
      <div className="block-full" style={{ justifySelf: 'end', width: '100%' }}>
        <Card
          title="Agents"
          subtitle="Top agents by total cost (last 30 days)"
          className="w-full"
        >
          {agentsError && !agentsLoading ? (
            <ErrorState message={agentsError} />
          ) : null}
          {agentsLoading ? (
            <LoadingState message="Loading agents summary…" height={180} />
          ) : (
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <AgentsBar items={compactChartItems} loading={false} />
              </div>
              <div>
                <AgentsTable items={compactTableItems} loading={false} />
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Full-width trend row aligned to the right by spanning all columns */}
      <div className="block-full" style={{ justifySelf: 'end', width: '100%' }}>
        <Card title="Activity trend" subtitle="Weekly activity overview" className="w-full">
          {error && <div className="error" role="alert">{error}</div>}
          {loading ? (
            <div style={{ width: "100%", height: 280 }}>
              <Skeleton width="100%" height="100%" aria-label="Loading activity trend" />
            </div>
          ) : (
            <KPIChart data={trend} xKey="label" yKey="value" />
          )}
        </Card>
      </div>
    </div>
  );
}
