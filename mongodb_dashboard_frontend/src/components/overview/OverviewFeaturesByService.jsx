import React, { useEffect, useMemo, useState } from 'react';
import { fetchSessionTrackingByService } from '../../api/sessionTracking';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, LabelList } from 'recharts';

function DateFilterTabs({ value, onChange }) {
  const tabs = ['daily', 'weekly', 'monthly', 'custom'];
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
      {tabs.map(t => (
        <button
          key={t}
          onClick={() => onChange(t)}
          style={{
            padding: '6px 10px',
            borderRadius: 8,
            border: value === t ? '1px solid #2563EB' : '1px solid #e5e7eb',
            background: value === t ? '#EBF2FF' : '#fff',
            color: value === t ? '#2563EB' : '#111827',
            cursor: 'pointer',
          }}
        >
          {t.charAt(0).toUpperCase() + t.slice(1)}
        </button>
      ))}
    </div>
  );
}

/**
 * PUBLIC_INTERFACE
 * OverviewFeaturesByService
 * Displays aggregated features usage by service_type with date filters.
 */
export default function OverviewFeaturesByService() {
  const [filter, setFilter] = useState('daily');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);

  const canSubmitCustom = useMemo(() => {
    if (filter !== 'custom') return true;
    return Boolean(startDate) && Boolean(endDate);
  }, [filter, startDate, endDate]);

  async function load() {
    setLoading(true);
    try {
      const params = { date_filter: filter };
      if (filter === 'custom') {
        params.start_date = startDate;
        params.end_date = endDate;
      }
      const data = await fetchSessionTrackingByService(params);
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotal(Number(data.total || 0));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to load session-tracking aggregate', e);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (filter !== 'custom') {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const chartData = useMemo(() => {
    return items.map(it => ({ name: String(it.service_type || 'unknown'), count: Number(it.count || 0) }));
  }, [items]);

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: 16, color: '#111827' }}>Overall Features by Service</h3>
        <div style={{ fontSize: 12, color: '#6b7280' }}>Total: {total}</div>
      </div>

      <DateFilterTabs value={filter} onChange={setFilter} />

      {filter === 'custom' && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #e5e7eb' }}
          />
          <span>to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #e5e7eb' }}
          />
          <button
            onClick={load}
            disabled={!canSubmitCustom}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid #2563EB',
              background: canSubmitCustom ? '#2563EB' : '#9ca3af',
              color: '#fff',
              cursor: canSubmitCustom ? 'pointer' : 'not-allowed'
            }}
          >
            Apply
          </button>
        </div>
      )}

      <div style={{ width: '100%', height: 300 }}>
        {loading ? (
          <div style={{ padding: 16, color: '#6b7280' }}>Loading...</div>
        ) : (
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#2563EB" radius={[6, 6, 0, 0]}>
                <LabelList dataKey="count" position="top" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
