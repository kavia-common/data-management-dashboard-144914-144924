import React, { useEffect, useMemo, useState } from 'react';

// PUBLIC_INTERFACE
export default function Costs() {
  /**
   * Costs table that fetches enriched costs from backend (/api/costs).
   * Reads cost.user_name directly from API; falls back to "Unknown User" defensively.
   * Preserves client-side sort/filter on user_name column.
   */
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState('-timestamp');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filterText, setFilterText] = useState('');

  const API_BASE = process.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_API_BASE_URL || '';

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL('/api/costs', API_BASE).toString();
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      params.set('sort', sort);
      // Include a filter only if needed; server has whitelist; we keep it empty by default.
      const reqUrl = `${url}?${params.toString()}`;

      const res = await fetch(reqUrl, {
        headers: {
          'Content-Type': 'application/json',
          // Tenant scoping: in demo environments this may be required
          ...(process.env.REACT_APP_ORGANIZATION_ID ? { 'x-organization-id': process.env.REACT_APP_ORGANIZATION_ID } : {})
        }
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Request failed with ${res.status}`);
      }
      const body = await res.json();
      const data = Array.isArray(body?.data) ? body.data : [];
      const normalized = data.map(d => ({
        ...d,
        user_name: typeof d.user_name === 'string' && d.user_name.trim() ? d.user_name : 'Unknown User'
      }));

      setItems(normalized);
      setTotal(body?.meta?.total || normalized.length);
    } catch (e) {
      setError(e?.message || 'Failed to load costs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, sort]);

  const filtered = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i => {
      const uname = (i.user_name || 'Unknown User').toLowerCase();
      const provider = (i.provider || '').toLowerCase();
      const model = (i.model || i.llm_model || '').toLowerCase();
      return uname.includes(q) || provider.includes(q) || model.includes(q);
    });
  }, [items, filterText]);

  const sorted = useMemo(() => {
    // If the backend sort is used, we keep it; this client-side sort is only applied for local user_name toggle.
    return filtered.slice().sort((a, b) => {
      if (sort === 'user_name') {
        return (a.user_name || '').localeCompare(b.user_name || '');
      }
      if (sort === '-user_name') {
        return (b.user_name || '').localeCompare(a.user_name || '');
      }
      return 0; // keep server ordering for other sorts
    });
  }, [filtered, sort]);

  const onHeaderClick = (key) => {
    setPage(1);
    if (sort === key) setSort(`-${key}`);
    else if (sort === `-${key}`) setSort(key);
    else setSort(key);
  };

  return (
    <div className="costs-container" style={{ padding: 16 }}>
      <h2>Costs</h2>

      <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
        <input
          type="text"
          placeholder="Filter by user, provider, or model"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          style={{ padding: 8, borderRadius: 6, border: '1px solid #e5e7eb', minWidth: 260 }}
        />
        <button onClick={() => setPage(Math.max(1, page - 1))} disabled={loading || page <= 1}>Prev</button>
        <span>Page {page}</span>
        <button onClick={() => setPage(page + 1)} disabled={loading || (page * limit) >= total}>Next</button>
      </div>

      {loading && <div>Loading costs…</div>}
      {error && <div style={{ color: '#EF4444' }}>Error: {error}</div>}

      {!loading && !error && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '8px 6px', cursor: 'pointer' }} onClick={() => onHeaderClick('user_name')}>User</th>
                <th style={{ padding: '8px 6px' }}>Provider</th>
                <th style={{ padding: '8px 6px' }}>Model</th>
                <th style={{ padding: '8px 6px' }}>Timestamp</th>
                <th style={{ padding: '8px 6px' }}>Cost (USD)</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => {
                const uname = typeof row.user_name === 'string' && row.user_name.trim() ? row.user_name : 'Unknown User';
                return (
                  <tr key={row._id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '8px 6px' }}>{uname}</td>
                    <td style={{ padding: '8px 6px' }}>{row.provider || '-'}</td>
                    <td style={{ padding: '8px 6px' }}>{row.model || row.llm_model || '-'}</td>
                    <td style={{ padding: '8px 6px' }}>{row.timestamp ? new Date(row.timestamp).toLocaleString() : '-'}</td>
                    <td style={{ padding: '8px 6px' }}>{typeof row.cost_usd === 'number' ? row.cost_usd.toFixed(6) : (typeof row.total_cost === 'number' ? row.total_cost.toFixed(6) : '-')}</td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ padding: '12px 6px', color: '#6b7280' }}>No results</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
