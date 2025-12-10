import React, { useMemo } from 'react';
import useUsersSignupTrend from '../../hooks/useUsersSignupTrend';

/**
 * PUBLIC_INTERFACE
 * UsersSignupBarChart
 * A simple bar chart for user signups using <canvas> with minimal dependency footprint.
 * If a global charting lib exists elsewhere, this component keeps isolation by rendering basic bars.
 */
export default function UsersSignupBarChart() {
  const { data, loading, error, params, setParams } = useUsersSignupTrend({ range: 'daily' });

  const max = useMemo(() => {
    return data?.buckets && data.buckets.length ? Math.max(...data.buckets.map(b => Number(b.count || 0))) : 0;
  }, [data]);

  const onRangeChange = (e) => {
    const v = e.target.value;
    if (v === 'custom') {
      const today = new Date();
      const iso = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
      setParams(p => ({ ...p, range: 'custom', start_date: iso(today), end_date: iso(today) }));
    } else {
      setParams(p => ({ organization_id: p.organization_id, range: v }));
    }
  };
  const onDateChange = (key) => (e) => setParams(p => ({ ...p, [key]: e.target.value }));

  return (
    <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, color: '#111827' }}>User Signups</h3>
          <p style={{ margin: 0, color: '#6b7280', fontSize: 12 }}>New users by {params.range === 'custom' ? 'day (custom range)' : params.range}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={params.range} onChange={onRangeChange} style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #e5e7eb' }}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="custom">Custom</option>
          </select>
          {params.range === 'custom' && (
            <>
              <input type="date" value={params.start_date || ''} onChange={onDateChange('start_date')} style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #e5e7eb' }} />
              <input type="date" value={params.end_date || ''} onChange={onDateChange('end_date')} style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #e5e7eb' }} />
            </>
          )}
        </div>
      </div>

      {loading && <div style={{ color: '#6b7280', fontSize: 12 }}>Loading…</div>}
      {error && <div style={{ color: '#ef4444', fontSize: 12 }}>Failed to load: {String(error.message || error)}</div>}

      <div style={{ height: 220, position: 'relative', overflowX: 'auto' }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'end', gap: 6, paddingBottom: 20, paddingLeft: 8, paddingRight: 8 }}>
          {(data?.buckets || []).map((b, idx) => {
            const h = max > 0 ? (Number(b.count || 0) / max) * 160 + 4 : 4;
            return (
              <div key={idx} title={`${b.label}: ${b.count}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 30 }}>
                <div style={{ width: 24, height: h, background: '#2563EB', borderRadius: 6 }} />
                <div style={{ marginTop: 6, fontSize: 10, color: '#6b7280', whiteSpace: 'nowrap' }}>{b.label}</div>
              </div>
            );
          })}
          {!data?.buckets?.length && !loading && (
            <div style={{ color: '#6b7280', fontSize: 12 }}>No data</div>
          )}
        </div>
      </div>
    </div>
  );
}
