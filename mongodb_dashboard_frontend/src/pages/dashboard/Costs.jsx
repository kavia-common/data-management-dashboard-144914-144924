import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

/**
 * PUBLIC_INTERFACE
 * Costs table page
 * Fetches /api/llm_costs?organization_id=<id> and renders a table with:
 * organization_id, organization_name, organization_cost, users,
 * user_id, type, user_cost, projects
 */
const Costs = ({ organizationId, className = '' }) => {
  const [data, setData] = useState([]);
  const [meta, setMeta] = useState({ total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const orgId = organizationId || localStorage.getItem('activeOrganizationId') || '';

  const columns = useMemo(() => [
    { key: 'organization_id', label: 'Organization ID' },
    { key: 'organization_name', label: 'Organization' },
    { key: 'organization_cost', label: 'Org Cost (USD)' },
    { key: 'users', label: 'Users' },
    { key: 'user_id', label: 'User ID' },
    { key: 'type', label: 'Type' },
    { key: 'user_cost', label: 'User Cost (USD)' },
    { key: 'projects', label: 'Projects' },
  ], []);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const params = {};
        if (orgId) params.organization_id = orgId;
        const res = await axios.get('/api/llm_costs', { params });
        if (!isMounted) return;
        const payload = res?.data || {};
        setData(Array.isArray(payload.data) ? payload.data : []);
        setMeta(payload.meta || {});
      } catch (e) {
        setError(e?.response?.data?.message || e?.message || 'Failed to load costs');
        setData([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => { isMounted = false; };
  }, [orgId]);

  return (
    <div className={`p-4 ${className}`}>
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-[#111827]">LLM Costs</h2>
        <p className="text-sm text-gray-600">Aggregated by organization and user</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="p-3 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {orgId ? `Organization: ${orgId}` : 'No organization selected'}
          </div>
          <div className="text-sm text-gray-500">
            Total rows: {meta?.total || 0}
          </div>
        </div>
        {loading ? (
          <div className="p-6 text-sm text-gray-500">Loading…</div>
        ) : error ? (
          <div className="p-6 text-sm text-red-600">{error}</div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full border-t border-gray-100">
              <thead className="bg-gradient-to-r from-blue-500/10 to-gray-50">
                <tr>
                  {columns.map(col => (
                    <th key={col.key} className="text-left text-xs font-semibold text-gray-700 uppercase tracking-wide px-4 py-3">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.length === 0 && (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-6 text-sm text-gray-500 text-center">
                      No records found.
                    </td>
                  </tr>
                )}
                {data.map((row, idx) => (
                  <tr key={idx} className="odd:bg-white even:bg-gray-50 hover:bg-blue-50/40 transition-colors">
                    {columns.map(col => (
                      <td key={col.key} className="px-4 py-2 text-sm text-gray-800">
                        {typeof row[col.key] === 'number'
                          ? row[col.key].toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 6 })
                          : (row[col.key] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Costs;
