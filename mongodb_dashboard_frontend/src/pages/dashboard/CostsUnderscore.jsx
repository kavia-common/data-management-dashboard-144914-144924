import React, { useState } from 'react';

/**
 * PUBLIC_INTERFACE
 * CostsUnderscore Page
 * Renders a Load button to fetch GET /api/llm_costs?organization_id=<id> and displays a table with:
 * organization_id, organization_name, organization_cost, users, user_id, type, user_cost, projects
 *
 * Note: No auto-fetch on mount; users must click Load.
 */
export default function CostsUnderscore() {
  const [organizationId, setOrganizationId] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  // PUBLIC_INTERFACE
  async function loadData() {
    setErr('');
    setRows([]);
    const org = organizationId.trim();
    if (!org) {
      setErr('Please enter an organization_id to load data.');
      return;
    }
    setLoading(true);
    try {
      const base =
        process.env.REACT_APP_BACKEND_URL ||
        process.env.REACT_APP_API_BASE_URL ||
        '';
      const urlBase = base ? base.replace(/\/$/, '') : '';
      const url = `${urlBase}/api/llm_costs?organization_id=${encodeURIComponent(org)}`;
      const resp = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.message || `Request failed with ${resp.status}`);
      }
      setRows(Array.isArray(data?.data) ? data.data : []);
    } catch (e) {
      setErr(e?.message || 'Failed to load costs');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginBottom: 12 }}>LLM Costs (underscore API)</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          type="text"
          placeholder="organization_id"
          value={organizationId}
          onChange={(e) => setOrganizationId(e.target.value)}
          style={{ padding: 8, minWidth: 260 }}
        />
        <button
          onClick={loadData}
          disabled={loading}
          style={{
            padding: '8px 12px',
            background: '#2563EB',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: loading ? 'default' : 'pointer',
          }}
        >
          {loading ? 'Loading...' : 'Load'}
        </button>
      </div>
      {err && (
        <div style={{ color: '#EF4444', marginBottom: 12 }}>
          Error: {err}
        </div>
      )}
      {!loading && rows.length === 0 && !err && (
        <div style={{ color: '#6b7280' }}>
          No data. Enter an organization_id and click Load.
        </div>
      )}
      {rows.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              borderCollapse: 'collapse',
              width: '100%',
              background: '#ffffff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              borderRadius: 8,
            }}
          >
            <thead>
              <tr style={{ background: '#f3f4f6' }}>
                <th style={th}>organization_id</th>
                <th style={th}>organization_name</th>
                <th style={th}>organization_cost</th>
                <th style={th}>users</th>
                <th style={th}>user_id</th>
                <th style={th}>type</th>
                <th style={th}>user_cost</th>
                <th style={th}>projects</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={idx} style={{ borderTop: '1px solid #e5e7eb' }}>
                  <td style={td}>{r.organization_id ?? ''}</td>
                  <td style={td}>{r.organization_name ?? ''}</td>
                  <td style={td}>{formatCurrencyUSD(r.organization_cost)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{formatInt(r.users)}</td>
                  <td style={td}>{r.user_id ?? ''}</td>
                  <td style={td}>{r.type ?? ''}</td>
                  <td style={td}>{formatCurrencyUSD(r.user_cost)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{formatInt(r.projects)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const th = {
  textAlign: 'left',
  padding: '10px 12px',
  fontWeight: 600,
  fontSize: 14,
  color: '#111827',
  borderBottom: '1px solid #e5e7eb',
};

const td = {
  padding: '10px 12px',
  fontSize: 14,
  color: '#111827',
};

function formatCurrencyUSD(n) {
  const num = typeof n === 'number' ? n : Number(n || 0);
  if (!isFinite(num)) return '$0.00';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 6 }).format(num);
  } catch {
    return `$${num.toFixed(2)}`;
  }
}
function formatInt(n) {
  const num = typeof n === 'number' ? n : Number.parseInt(n || 0, 10);
  return Number.isFinite(num) ? num.toLocaleString() : '0';
}
