import React from 'react';
import Card from '../common/Card';
import { formatCurrencyAmount as formatCurrency } from '../../utils/formatCurrency';

/**
 * PUBLIC_INTERFACE
 * Renders a simple bar chart-like visualization for agent costs using existing minimal primitives.
 * Expects data: [{ agent_name, total_cost }]
 */
export default function AgentCostBarChart({ data = [], loading = false, error = null }) {
  /** This is a public function. */
  if (loading) {
    return (
      <Card title="Agent Costs">
        <div className="p-4 text-sm text-gray-500">Loading chart…</div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card title="Agent Costs">
        <div className="p-4 text-sm text-red-600">Failed to load agent costs.</div>
      </Card>
    );
  }

  if (!data.length) {
    return (
      <Card title="Agent Costs">
        <div className="p-4 text-sm text-gray-500">No data available.</div>
      </Card>
    );
  }

  const max = Math.max(...data.map(d => Number(d.total_cost || 0)));
  const safeMax = max || 1;

  return (
    <Card title="Agent Costs">
      <div className="p-4 space-y-2">
        {data.map((d, idx) => {
          const widthPct = Math.max(2, Math.round((Number(d.total_cost || 0) / safeMax) * 100));
          return (
            <div key={idx} className="space-y-1">
              <div className="flex justify-between text-xs text-gray-600">
                <span className="truncate pr-2">{d.agent_name || d.agent || 'Unknown'}</span>
                <span className="font-medium">{formatCurrency(Number(d.total_cost || 0))}</span>
              </div>
              <div className="w-full bg-gray-100 rounded h-3 overflow-hidden">
                <div
                  className="h-3 rounded bg-blue-500"
                  style={{ width: `${widthPct}%` }}
                  aria-label={`Cost bar for ${d.agent_name || d.agent}`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
