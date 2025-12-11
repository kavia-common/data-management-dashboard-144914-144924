import React, { useEffect, useMemo, useState } from 'react';
import { getOverviewProjects } from '../../api/overviewProjects';
import OverviewTotalProjectsChart from './OverviewTotalProjectsChart';

/**
// PUBLIC_INTERFACE
 * OverviewTotalProjectsSection
 * Renders filters + total projects chart and summary.
 */
export default function OverviewTotalProjectsSection() {
  const [range, setRange] = useState('daily');
  const today = new Date();
  const toStr = today.toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(toStr);
  const [endDate, setEndDate] = useState(toStr);

  const [loading, setLoading] = useState(false);
  const [dataBuckets, setDataBuckets] = useState([]);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [byUser, setByUser] = useState([]);

  const apiParams = useMemo(() => {
    const p = { timeframe: range };
    if (range === 'custom') {
      p.start_date = startDate;
      p.end_date = endDate;
    }
    return p;
  }, [range, startDate, endDate]);

  useEffect(() => {
    let mounted = true;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const resp = await getOverviewProjects(apiParams);
        if (!mounted) return;
        setDataBuckets(Array.isArray(resp?.buckets) ? resp.buckets : []);
        setTotal(Number(resp?.total || 0));
        setByUser(Array.isArray(resp?.byUser) ? resp.byUser : []);
      } catch (e) {
        if (!mounted) return;
        setError(e);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    run();
    return () => { mounted = false; };
  }, [apiParams]);

  return (
    <section style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Total Projects</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="btn-group" role="group" aria-label="Time range">
            <button type="button" className={`btn ${range === 'daily' ? 'btn-active' : ''}`} onClick={() => setRange('daily')}>Daily</button>
            <button type="button" className={`btn ${range === 'weekly' ? 'btn-active' : ''}`} onClick={() => setRange('weekly')}>Weekly</button>
            <button type="button" className={`btn ${range === 'monthly' ? 'btn-active' : ''}`} onClick={() => setRange('monthly')}>Monthly</button>
            <button type="button" className={`btn ${range === 'custom' ? 'btn-active' : ''}`} onClick={() => setRange('custom')}>Custom</button>
          </div>
          {range === 'custom' && (
            <div className="date-range" style={{ display: 'flex', gap: 8 }}>
              <label className="date-field" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span>From</span>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} max={endDate} />
              </label>
              <label className="date-field" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span>To</span>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate} />
              </label>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <OverviewTotalProjectsChart
          data={dataBuckets}
          loading={loading}
          error={error}
          height={350}
        />
        {(!loading && !error && (!dataBuckets || dataBuckets.length === 0)) && (
          <div role="status" aria-live="polite" style={{ marginTop: 8, color: '#6b7280' }}>
            No data to display for the selected range.
          </div>
        )}
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: 12,
          minWidth: 220
        }}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Total projects</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: '#111827' }}>{total}</div>
        </div>

        <div style={{
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: 12,
          minWidth: 260,
          flex: '1 1 300px'
        }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Top users</div>
          {byUser && byUser.length > 0 ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 4 }}>
              {byUser.slice(0, 5).map((u) => (
                <li key={u.user_name || 'unknown'} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ color: '#374151' }}>{u.user_name || 'unknown'}</span>
                  <span style={{ color: '#2563EB', fontWeight: 600 }}>{u.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ color: '#6b7280', fontSize: 13 }}>No user breakdown</div>
          )}
        </div>
      </div>
    </section>
  );
}
