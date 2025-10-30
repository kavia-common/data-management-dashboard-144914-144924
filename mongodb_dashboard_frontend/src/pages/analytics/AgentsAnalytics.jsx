import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '../../components/layout/AppLayout';
import Card from '../../components/common/Card';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import { getAgentsAnalytics } from '../../api/agentsAnalytics';
import AgentCostBarChart from '../../components/analytics/AgentCostBarChart';
import AgentsUsageTable from '../../components/analytics/AgentsUsageTable';
import TimeBucketFilter from '../../components/common/TimeBucketFilter';
import { useSearchParams } from 'react-router-dom';

/**
 * PUBLIC_INTERFACE
 * Page to display analytics grouped by agents.
 * Reads optional query params: tenant_id, project_id, from, to, limit, offset.
 * Renders a bar chart (agent vs total_cost) and a table of usage/cost.
 */
export default function AgentsAnalytics() {
  /** This is a public function. */
  const [params, setParams] = useState({});
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize filters from query string
  useEffect(() => {
    const p = Object.fromEntries(searchParams.entries());
    setParams(p);
  }, [searchParams]);

  const handleTimeChange = (range) => {
    // TimeBucketFilter likely exposes { from, to }, we update the URL search params
    const next = {
      ...Object.fromEntries(searchParams.entries()),
      ...(range?.from ? { from: range.from } : {}),
      ...(range?.to ? { to: range.to } : {}),
    };
    // Remove empty keys
    Object.keys(next).forEach((k) => {
      if (next[k] === undefined || next[k] === null || next[k] === '') {
        delete next[k];
      }
    });
    setSearchParams(next);
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const { items: dataItems, total: dataTotal } = await getAgentsAnalytics(params);
        if (!cancelled) {
          setItems(dataItems || []);
          setTotal(dataTotal || 0);
        }
      } catch (e) {
        if (!cancelled) {
          setErr(e);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [params]);

  const chartData = useMemo(() => {
    return (items || []).map((it) => ({
      agent_name: it.agent_name || it.agent,
      total_cost: Number(it.total_cost || 0),
    }));
  }, [items]);

  return (
    <AppLayout title="Agents Analytics">
      <div className="space-y-4">
        <Card title="Filters">
          <div className="p-4 flex flex-wrap gap-4 items-center">
            <TimeBucketFilter onChange={handleTimeChange} />
          </div>
        </Card>

        {loading && <LoadingState message="Loading agents analytics…" />}
        {err && !loading && <ErrorState message="Failed to load agents analytics." details={err?.message} />}

        {!loading && !err && (
          <>
            <AgentCostBarChart data={chartData} loading={loading} error={err} />
            <AgentsUsageTable data={items} loading={loading} error={err} />
            <div className="text-xs text-gray-500 px-2">Total records: {total}</div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
