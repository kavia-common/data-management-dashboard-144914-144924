import React from 'react';
import Card from '../common/Card';
import DataTable from '../DataTable';
import { formatCurrencyAmount as formatCurrency } from '../../utils/formatCurrency';

/**
 * PUBLIC_INTERFACE
 * Table of agent usage and costs.
 * Expects data items with fields: agent_name (or agent), total_cost, total_minutes, total_usage.
 */
export default function AgentsUsageTable({ data = [], loading = false, error = null }) {
  /** This is a public function. */
  if (loading) {
    return (
      <Card title="Agents Usage">
        <div className="p-4 text-sm text-gray-500">Loading…</div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card title="Agents Usage">
        <div className="p-4 text-sm text-red-600">Failed to load data.</div>
      </Card>
    );
  }

  if (!data.length) {
    return (
      <Card title="Agents Usage">
        <div className="p-4 text-sm text-gray-500">No data available.</div>
      </Card>
    );
  }

  const columns = [
    {
      header: 'Agent',
      accessor: 'agent_name',
      cell: (row) => row.agent_name || row.agent || 'Unknown',
    },
    {
      header: 'Total Cost',
      accessor: 'total_cost',
      cell: (row) => formatCurrency(Number(row.total_cost || 0)),
    },
    {
      header: 'Total Minutes',
      accessor: 'total_minutes',
      cell: (row) => Number(row.total_minutes || 0).toLocaleString(),
    },
    {
      header: 'Total Usage',
      accessor: 'total_usage',
      cell: (row) => Number(row.total_usage || 0).toLocaleString(),
    },
  ];

  return (
    <Card title="Agents Usage">
      <div className="p-2">
        <DataTable data={data} columns={columns} />
      </div>
    </Card>
  );
}
