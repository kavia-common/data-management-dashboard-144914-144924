import React, { useEffect, useMemo, useState } from 'react';
import AgentCostBarChart from '../components/charts/AgentCostBarChart';
import AgentsUsageTable from '../components/tables/AgentsUsageTable';

// PUBLIC_INTERFACE
export default function AgentsAnalytics() {
  /** Agents analytics view: fetches /api/analytics/agents with optional filters and renders
   *  - Bar chart: agent_name vs total_cost
   *  - Table: agent_name, total_cost, total_usage, session_count
   */

  const [filters, setFilters] = useState(() => {
    // default last 30 days handled by backend; keep empty state
    return { tenant_id: '', project_id: '' };
  });
  const [data, setData] = useState({ items: [], total: 0, meta: {} });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.tenant_id) params.set('tenant_id', filters.tenant_id);
    if (filters.project_id) params.set('project_id', filters.project_id);
    // do not add dates here; let backend default to last 30 days unless user adds in future
    params.set('limit', '100');
    params.set('offset', '0');
    return params.toString();
  }, [filters]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setErr('');

    fetch(`/api/analytics/agents?${queryString}`)
      .then(r => {
        if (!r.ok) throw new Error(`Failed to fetch: ${r.status}`);
        return r.json();
      })
      .then(json => {
        if (!isMounted) return;
        setData(json);
      })
      .catch(e => {
        if (!isMounted) return;
        setErr(e.message || 'Failed to load agents analytics');
      })
      .finally(() => {
        if (!isMounted) return;
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [queryString]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="p-4">
      <div className="mb-4 bg-white rounded-lg shadow-sm p-4">
        <h2 className="text-lg font-semibold mb-2">Agents Analytics</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Tenant ID</label>
            <input
              type="text"
              name="tenant_id"
              value={filters.tenant_id}
              onChange={onChange}
              placeholder="e.g., org_123"
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Project ID</label>
            <input
              type="text"
              name="project_id"
              value={filters.project_id}
              onChange={onChange}
              placeholder="e.g., proj_abc"
              className="w-full border rounded px-3 py-2"
            />
          </div>
        </div>
      </div>

      {err && <div className="mb-4 text-red-600">Error: {err}</div>}

      <div className="mb-4 bg-white rounded-lg shadow-sm p-4">
        <h3 className="text-base font-semibold mb-2">Cost by Agent</h3>
        <AgentCostBarChart items={data.items || []} loading={loading} />
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4">
        <h3 className="text-base font-semibold mb-2">Usage & Sessions</h3>
        <AgentsUsageTable items={data.items || []} loading={loading} />
      </div>
    </div>
  );
}
