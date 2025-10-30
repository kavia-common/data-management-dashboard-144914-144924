import React, { useMemo, useState } from 'react';

// PUBLIC_INTERFACE
export default function AgentsUsageTable({ items = [], loading = false }) {
  const [sort, setSort] = useState({ key: 'total_cost', dir: 'desc' });

  const sorted = useMemo(() => {
    const arr = [...(items || [])];
    const { key, dir } = sort;
    arr.sort((a, b) => {
      const va = (a && a[key]) ?? 0;
      const vb = (b && b[key]) ?? 0;
      if (typeof va === 'string' && typeof vb === 'string') {
        return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return dir === 'asc' ? (va - vb) : (vb - va);
    });
    return arr;
  }, [items, sort]);

  const setSortKey = (key) => {
    setSort(prev => {
      if (prev.key === key) {
        return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
      }
      return { key, dir: 'desc' };
    });
  };

  const headerCell = (label, key) => (
    <th
      className="px-3 py-2 text-left cursor-pointer select-none"
      onClick={() => setSortKey(key)}
      title="Click to sort"
    >
      {label}
      {sort.key === key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
    </th>
  );

  if (loading) {
    return <div className="text-sm text-gray-500">Loading…</div>;
  }

  return (
    <div className="overflow-auto">
      <table className="min-w-full">
        <thead className="bg-gray-50">
          <tr>
            {headerCell('Agent', 'agent_name')}
            {headerCell('Total Cost', 'total_cost')}
            {headerCell('Total Usage', 'total_usage')}
            {headerCell('Sessions', 'session_count')}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr><td className="px-3 py-2 text-gray-500 text-sm" colSpan="4">No records</td></tr>
          )}
          {sorted.map((row) => (
            <tr key={row.agent_name} className="odd:bg-white even:bg-gray-50">
              <td className="px-3 py-2">{row.agent_name}</td>
              <td className="px-3 py-2">${(row.total_cost || 0).toFixed(6)}</td>
              <td className="px-3 py-2">{row.total_usage ?? 0}</td>
              <td className="px-3 py-2">{row.session_count ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
