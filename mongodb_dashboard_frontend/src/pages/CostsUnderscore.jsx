import React, { useState, useEffect, useCallback } from 'react';

// PUBLIC_INTERFACE
export default function CostsUnderscore() {
  /** PUBLIC_INTERFACE
   * Minimal Costs table consuming /api/llm_costs response with fields:
   * organization_id, organization_name, organization_cost, users, projects, cost
   * Provides an input for organization_id, a Load button, a page-size dropdown, and page controls.
   * Changing page size triggers a GET /api/llm_costs?organization_id=&page=&limit= refetch.
   */
  const [organizationId, setOrganizationId] = useState('');
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function fmtUSD(n) {
    const num = Number(n || 0);
    return num.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
  }
  function fmtInt(n) {
    const num = Number(n || 0);
    return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }

  // PUBLIC_INTERFACE
  const handleLoad = useCallback(async (page = 1, limit = 10) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (organizationId.trim()) {
        params.set('organization_id', organizationId.trim());
      }
      const resp = await fetch(`/api/llm_costs?${params.toString()}`);
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Request failed: ${resp.status} ${txt}`);
      }
      const data = await resp.json();
      setRows(Array.isArray(data?.data) ? data.data : []);
      setMeta(data?.meta || { page, limit, total: 0 });
    } catch (e) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  // When page size (limit) changes, reset to page=1 and refetch if there is existing data or org filter set
  useEffect(() => {
    // Auto-refetch on page size change only after initial load or when an org is provided
    if (meta.limit && (rows.length > 0 || organizationId.trim())) {
      handleLoad(1, meta.limit);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.limit]);

  // PUBLIC_INTERFACE
  const onChangePageSize = (e) => {
    const next = Number(e.target.value) || 10;
    setMeta((m) => ({ ...m, page: 1, limit: next }));
  };

  // PUBLIC_INTERFACE
  const onPrev = () => {
    const nextPage = Math.max(1, (meta.page || 1) - 1);
    handleLoad(nextPage, meta.limit || 10);
  };

  // PUBLIC_INTERFACE
  const onNext = () => {
    // Basic guard: if current page returned fewer than limit, don't go next
    if (rows.length < (meta.limit || 10)) return;
    const nextPage = (meta.page || 1) + 1;
    handleLoad(nextPage, meta.limit || 10);
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-3">Organization LLM Costs</h2>

      <div className="flex gap-2 items-end mb-4 flex-wrap">
        <div className="flex flex-col">
          <label className="text-sm text-gray-600 mb-1">Organization ID (optional)</label>
          <input
            type="text"
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
            placeholder="e.g., orgA or b2c"
            className="border rounded px-3 py-2"
          />
        </div>

        <div className="flex flex-col">
          <label htmlFor="page-size" className="text-sm text-gray-600 mb-1">Page size</label>
          <select
            id="page-size"
            className="border rounded px-3 py-2"
            value={meta.limit}
            onChange={onChangePageSize}
            aria-label="Select page size"
          >
            {[10, 20, 50, 100, 200].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        <button
          onClick={() => handleLoad(1, meta.limit || 10)}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-2 transition"
        >
          {loading ? 'Loading...' : 'Load'}
        </button>

        {error && (
          <div className="bg-red-50 text-red-700 border border-red-200 rounded p-3">
            {error}
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border rounded">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2 border-b">Organization ID</th>
              <th className="text-left px-4 py-2 border-b">Organization Name</th>
              <th className="text-right px-4 py-2 border-b">Organization Cost</th>
              <th className="text-right px-4 py-2 border-b">Users</th>
              <th className="text-right px-4 py-2 border-b">Projects</th>
              <th className="text-right px-4 py-2 border-b">Cost</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="text-center text-gray-500 px-4 py-6">
                  No data. Click Load to fetch results.
                </td>
              </tr>
            )}
            {rows.map((r, idx) => (
              <tr key={`${r.organization_id || 'row'}-${idx}`} className="hover:bg-gray-50">
                <td className="px-4 py-2 border-b">{r.organization_id || '-'}</td>
                <td className="px-4 py-2 border-b">{r.organization_name || '-'}</td>
                <td className="px-4 py-2 border-b text-right">{fmtUSD(r.organization_cost)}</td>
                <td className="px-4 py-2 border-b text-right">{fmtInt(r.users)}</td>
                <td className="px-4 py-2 border-b text-right">{fmtInt(r.projects)}</td>
                <td className="px-4 py-2 border-b text-right">{fmtUSD(r.cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length > 0 && (
        <div className="flex items-center justify-between mt-3 text-sm text-gray-600">
          <div>
            Page {meta.page} • Limit {meta.limit} • Total {fmtInt(meta.total)}
          </div>
          <div className="flex gap-2">
            <button
              disabled={loading || meta.page <= 1}
              onClick={onPrev}
              className="border rounded px-3 py-1 disabled:opacity-50"
            >
              Prev
            </button>
            <button
              disabled={loading || (rows.length < (meta.limit || 10))}
              onClick={onNext}
              className="border rounded px-3 py-1 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
