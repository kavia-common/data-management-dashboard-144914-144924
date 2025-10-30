import React, { useMemo } from 'react';

// PUBLIC_INTERFACE
export default function AgentCostBarChart({ items = [], loading = false }) {
  /**
   * Minimal horizontal bar chart using divs; no external dependency.
   * Expects items: [{ agent_name, total_cost }]
   */
  const topItems = useMemo(() => {
    return (items || []).slice(0, 15);
  }, [items]);

  const max = useMemo(() => {
    return topItems.reduce((m, x) => Math.max(m, x.total_cost || 0), 0) || 1;
  }, [topItems]);

  if (loading) {
    return <div className="text-sm text-gray-500">Loading chart…</div>;
  }

  if (!topItems.length) {
    return <div className="text-sm text-gray-500">No data</div>;
  }

  return (
    <div className="space-y-2">
      {topItems.map((row) => {
        const pct = Math.max(2, Math.round(((row.total_cost || 0) / max) * 100));
        return (
          <div key={row.agent_name} className="flex items-center gap-3">
            <div className="w-40 text-sm truncate" title={row.agent_name}>{row.agent_name}</div>
            <div className="flex-1 bg-gray-100 rounded h-6 overflow-hidden">
              <div
                className="h-6 bg-blue-500 text-white text-xs flex items-center px-2"
                style={{ width: `${pct}%` }}
                title={`$${(row.total_cost || 0).toFixed(4)}`}
              >
                ${ (row.total_cost || 0).toFixed(4) }
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
