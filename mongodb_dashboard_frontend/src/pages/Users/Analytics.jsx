import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchUsersKpis,
  fetchDauTrend,
  fetchActiveByDepartment,
  fetchActiveVsInactive,
  fetchTopActiveUsers,
} from '../../api/usersAnalytics';
import Card from '../../components/common/Card';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import '../../styles/theme.css';
import '../../styles/globals.css';
import { useTheme } from '../../theme';
import { format } from 'date-fns';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import { useLocation, useNavigate } from 'react-router-dom';

// Lightweight chart renderers using SVG to avoid adding dependencies
function LineChart({ data = [], color = '#2563EB', height = 160 }) {
  if (!data || data.length === 0) return <div style={{ padding: 12, color: '#6b7280' }}>No data</div>;
  const w = 520;
  const h = height;
  const pad = 24;
  const ys = data.map(d => d.value ?? d.total ?? 0);
  const minY = 0;
  const maxY = Math.max(...ys, 1);
  const points = data.map((d, i) => {
    const x = pad + (i * (w - pad * 2)) / Math.max(data.length - 1, 1);
    const y = h - pad - ((d.value ?? d.total ?? 0) - minY) * (h - pad * 2) / (maxY - minY || 1);
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Line chart">
      <polyline fill="none" stroke={color} strokeWidth="2" points={points} />
    </svg>
  );
}

function BarChart({ data = [], color = '#2563EB', height = 180 }) {
  if (!data || data.length === 0) return <div style={{ padding: 12, color: '#6b7280' }}>No data</div>;
  const w = 520; const h = height; const pad = 24;
  const maxV = Math.max(...data.map(d => d.value ?? d.count ?? d.total ?? 0), 1);
  const barW = (w - pad * 2) / data.length - 8;
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Bar chart">
      {data.map((d, i) => {
        const v = d.value ?? d.count ?? d.total ?? 0;
        const x = pad + i * ((w - pad * 2) / data.length);
        const barH = (v / maxV) * (h - pad * 2);
        const y = h - pad - barH;
        return <rect key={i} x={x} y={y} width={barW} height={barH} fill={color} rx="4" />;
      })}
    </svg>
  );
}

function PieChart({ data = [], colors = ['#2563EB', '#F59E0B'], size = 180 }) {
  if (!data || data.length === 0) return <div style={{ padding: 12, color: '#6b7280' }}>No data</div>;
  const total = data.reduce((s, d) => s + (d.value ?? d.count ?? 0), 0) || 1;
  const cx = size / 2; const cy = size / 2; const r = size / 2 - 6;
  let acc = 0;
  const toXY = (angle) => [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  const arcs = data.map((d, i) => {
    const v = (d.value ?? d.count ?? 0) / total;
    const start = acc * 2 * Math.PI - Math.PI / 2;
    const end = (acc + v) * 2 * Math.PI - Math.PI / 2;
    acc += v;
    const [x1, y1] = toXY(start);
    const [x2, y2] = toXY(end);
    const largeArc = v > 0.5 ? 1 : 0;
    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    return <path key={i} d={path} fill={colors[i % colors.length]} />;
  });
  return (
    <svg width={size} height={size} role="img" aria-label="Pie chart">
      {arcs}
    </svg>
  );
}

function FilterPanel({ filters, setFilters }) {
  const { theme } = useTheme();
  const [local, setLocal] = useState(filters);

  useEffect(() => setLocal(filters), [filters]);

  const onChange = (field, value) => {
    setLocal(prev => ({ ...prev, [field]: value }));
  };

  const apply = () => setFilters(local);
  const reset = () => setFilters({ from: defaultFrom(), to: todayIso(), organization: '', department: '', status: '' });

  return (
    <div style={{
      background: theme.surface,
      border: `1px solid ${theme.border ?? '#e5e7eb'}`,
      borderRadius: 12,
      padding: 16,
      display: 'grid',
      gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
      gap: 12,
      alignItems: 'end',
    }}>
      <div>
        <label className="label">From</label>
        <input type="date" className="input" value={local.from?.slice(0,10) || ''} onChange={(e)=>onChange('from', toIsoDate(e.target.value))} />
      </div>
      <div>
        <label className="label">To</label>
        <input type="date" className="input" value={local.to?.slice(0,10) || ''} onChange={(e)=>onChange('to', toIsoDate(e.target.value))} />
      </div>
      <div>
        <label className="label">Organization</label>
        <input type="text" className="input" placeholder="tenant or org id" value={local.organization || ''} onChange={(e)=>onChange('organization', e.target.value)} />
      </div>
      <div>
        <label className="label">Department</label>
        <input type="text" className="input" placeholder="department" value={local.department || ''} onChange={(e)=>onChange('department', e.target.value)} />
      </div>
      <div>
        <label className="label">Status</label>
        <select className="input" value={local.status || ''} onChange={(e)=>onChange('status', e.target.value)}>
          <option value="">Any</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" onClick={apply}>Apply Filters</button>
        <button className="btn" onClick={reset}>Reset</button>
      </div>
    </div>
  );
}

function Kpi({ title, value, accent }) {
  return (
    <div className="kpi-card" style={{ borderTop: `3px solid ${accent}` }}>
      <div className="kpi-title">{title}</div>
      <div className="kpi-value">{value}</div>
    </div>
  );
}

function defaultFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString();
}
function todayIso() {
  return new Date().toISOString();
}
function toIsoDate(v) {
  if (!v) return '';
  try {
    const d = new Date(v);
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString();
  } catch {
    return '';
  }
}

function parseSearch(search) {
  const usp = new URLSearchParams(search || '');
  const from = usp.get('from') || defaultFrom();
  const to = usp.get('to') || todayIso();
  const organization = usp.get('org') || '';
  const department = usp.get('dept') || '';
  const status = usp.get('status') || '';
  return { from, to, organization, department, status };
}

function toSearch(filters) {
  const usp = new URLSearchParams();
  if (filters.organization) usp.set('org', filters.organization);
  if (filters.department) usp.set('dept', filters.department);
  if (filters.status) usp.set('status', filters.status);
  if (filters.from) usp.set('from', filters.from);
  if (filters.to) usp.set('to', filters.to);
  const s = usp.toString();
  return s ? `?${s}` : '';
}

export default function UsersAnalyticsPage() {
  const { theme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  // Initialize from URL to preserve filters across reloads
  const initial = useMemo(() => parseSearch(location.search), [location.search]);
  const [filters, setFilters] = useState(initial);

  // Debounce filters to avoid rapid calls
  const debounced = useDebouncedValue(filters, 300);

  // Per-widget loading and error states
  const [loading, setLoading] = useState(false);
  const [kpis, setKpis] = useState(null);
  const [dau, setDau] = useState([]);
  const [byDept, setByDept] = useState([]);
  const [activePie, setActivePie] = useState([]);
  const [topUsers, setTopUsers] = useState([]);

  const [error, setError] = useState(null);

  // Sync URL when filters change (not debounced so users see URL stay in sync)
  useEffect(() => {
    const next = toSearch(filters);
    const current = location.search || '';
    if (next !== current) {
      navigate({ pathname: location.pathname, search: next }, { replace: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const hydratedFilters = useMemo(() => ({
    from: debounced.from,
    to: debounced.to,
    organization: debounced.organization,
    department: debounced.department,
    status: debounced.status,
  }), [debounced]);

  const reload = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [kpiRes, dauRes, deptRes, pieRes, topRes] = await Promise.all([
        fetchUsersKpis(hydratedFilters),
        fetchDauTrend(hydratedFilters),
        fetchActiveByDepartment(hydratedFilters),
        fetchActiveVsInactive(hydratedFilters),
        fetchTopActiveUsers(hydratedFilters),
      ]);
      setKpis(kpiRes?.data || kpiRes || null);
      setDau((dauRes?.items || dauRes || []).map(d => ({ label: d.date || d.label || '', value: d.total ?? d.value ?? 0 })));
      setByDept((deptRes?.items || deptRes || []).map(d => ({ label: d.department || d.label || 'N/A', value: d.total ?? d.count ?? d.value ?? 0 })));
      const pieItems = (pieRes?.items || pieRes || []);
      setActivePie(pieItems.map(d => ({ label: d.status || d.label, value: d.count ?? d.value ?? 0 })));
      setTopUsers((topRes?.items || topRes || []).slice(0, 10));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to load analytics', e);
      setError(e?.message || 'Failed to load analytics data.');
    } finally {
      setLoading(false);
    }
  }, [hydratedFilters]);

  // Fetch on debounced filters
  useEffect(() => {
    reload();
  }, [reload]);

  const totalActive = kpis?.totalActiveUsers ?? kpis?.active ?? 0;
  const newUsers = kpis?.newUsers ?? kpis?.new ?? 0;
  const inactive = kpis?.inactiveUsers ?? kpis?.inactive ?? 0;
  const compliance = kpis?.compliancePercent ?? kpis?.compliance ?? 0;

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ color: theme.text, fontWeight: 600, fontSize: 22, marginBottom: 8 }}>Users Analytics</h1>
      <p style={{ color: '#6b7280', marginBottom: 16 }}>
        Insights into user activity, growth, and engagement across your organization.
      </p>

      <FilterPanel filters={filters} setFilters={setFilters} />

      {error ? (
        <div style={{ marginTop: 16 }}>
          <ErrorState message={error} onRetry={reload} />
        </div>
      ) : null}

      <div className="grid-4" style={{ marginTop: 16 }}>
        <Card title="Total Active Users" subtitle="" >
          {loading && !kpis ? <LoadingState height={84} message="Loading KPIs..." /> : <Kpi title="Total Active Users" value={totalActive} accent={theme.primary} />}
        </Card>
        <Card title="New Users" subtitle="">
          {loading && !kpis ? <LoadingState height={84} message="Loading KPIs..." /> : <Kpi title="New Users" value={newUsers} accent={theme.secondary} />}
        </Card>
        <Card title="Inactive Users" subtitle="">
          {loading && !kpis ? <LoadingState height={84} message="Loading KPIs..." /> : <Kpi title="Inactive Users" value={inactive} accent="#9CA3AF" />}
        </Card>
        <Card title="Compliance %" subtitle="">
          {loading && !kpis ? <LoadingState height={84} message="Loading KPIs..." /> : <Kpi title="Compliance %" value={`${Number(compliance).toFixed(1)}%`} accent="#10B981" />}
        </Card>
      </div>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <Card title="DAU - Last 30 Days" subtitle="Distinct active users per day">
          {loading && dau.length === 0 ? <LoadingState height={180} message="Loading DAU..." /> : (
            <>
              <LineChart color={theme.primary} data={dau} />
              <div className="chart-legend">
                {dau.slice(-5).map((d, i) => (
                  <span key={i} className="legend-item">
                    <span className="dot" style={{ background: theme.primary }} />
                    {d.label || format(new Date(), 'MM/dd')}
                  </span>
                ))}
              </div>
            </>
          )}
        </Card>
        <Card title="Active by Department" subtitle="Department-wise activity">
          {loading && byDept.length === 0 ? <LoadingState height={200} message="Loading department breakdown..." /> : (
            <>
              <BarChart color={theme.secondary} data={byDept} />
              <div className="tags">
                {byDept.slice(0, 6).map((d, i) => (<span className="tag" key={i}>{d.label}: {d.value}</span>))}
              </div>
            </>
          )}
        </Card>
      </div>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <Card title="Active vs Inactive" subtitle="Current user status breakdown">
          {loading && activePie.length === 0 ? <LoadingState height={200} message="Loading status breakdown..." /> : (
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <PieChart data={activePie} colors={[theme.primary, '#9CA3AF']} />
              <div>
                {activePie.map((d, i) => (
                  <div key={i} className="legend-item">
                    <span className="dot" style={{ background: i === 0 ? theme.primary : '#9CA3AF' }} />
                    {d.label}: {d.value}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
        <Card title="Top 10 Most Active Users" subtitle="By sessions or activity count">
          {loading && topUsers.length === 0 ? <LoadingState height={220} message="Loading top users..." /> : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Department</th>
                    <th>Organization</th>
                    <th>Activity</th>
                    <th>Last Active</th>
                  </tr>
                </thead>
                <tbody>
                  {(topUsers || []).map((u, i) => (
                    <tr key={i}>
                      <td>{u.user_name || u.user || u.email || u.userId || '—'}</td>
                      <td>{u.department || '—'}</td>
                      <td>{u.organization || u.tenant_id || '—'}</td>
                      <td>{u.activity || u.sessions || u.count || 0}</td>
                      <td>{u.last_active ? new Date(u.last_active).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                  {(!topUsers || topUsers.length === 0) && (
                    <tr><td colSpan="5" style={{ color: '#6b7280', textAlign: 'center' }}>No data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
