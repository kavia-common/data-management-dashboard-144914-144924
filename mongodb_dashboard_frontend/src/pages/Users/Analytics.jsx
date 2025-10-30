import React, { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { fetchActiveTrend, fetchKpiSummarySafe, fetchByDepartmentSafe, fetchByOrganizationSafe, fetchTermsAcceptanceSafe } from '../../api/usersAnalytics';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import './analytics.css';
import { getOceanTheme } from '../../theme/oceanTheme';

// Simple KPI Card component consistent with existing Card styles
function KpiCard({ title, value, subtitle, accent = 'primary' }) {
  const t = getOceanTheme();
  const colors = {
    primary: t.colors.primary || '#2563EB',
    secondary: t.colors.secondary || '#F59E0B',
    success: t.colors.success || '#10B981',
    danger: t.colors.error || '#EF4444'
  };
  const borderColor = colors[accent] || colors.primary;
  return (
    <div className="ua-card" style={{ borderTop: `3px solid ${borderColor}` }}>
      <div className="ua-card-title">{title}</div>
      <div className="ua-card-value">{value ?? '-'}</div>
      {subtitle ? <div className="ua-card-subtitle">{subtitle}</div> : null}
    </div>
  );
}

const COLORS = ['#2563EB', '#F59E0B', '#10B981', '#6366F1', '#EC4899', '#06B6D4', '#A78BFA'];

function formatDateLabel(s) {
  return s;
}

function buildParams(filters) {
  const params = {};
  if (filters.from) params.from = filters.from.toISOString();
  if (filters.to) params.to = filters.to.toISOString();
  if (filters.granularity === 'weekly') params.granularity = 'week';
  if (filters.granularity === 'daily') params.granularity = 'day';
  if (filters.organization_id) params.tenant_id = filters.organization_id; // backend uses tenant_id
  if (filters.status) params.status = filters.status;
  if (filters.is_admin != null) params.is_admin = filters.is_admin;
  if (filters.search) params.q = filters.search;
  return params;
}

function useInitialRange() {
  const now = new Date();
  const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return { start, end: now };
}

export default function UsersAnalyticsPage() {
  const initial = useInitialRange();
  const [granularity, setGranularity] = useState('daily'); // daily|weekly|monthly (monthly will map to month for new users; active trend supports day|week)
  const [range, setRange] = useState({ preset: 'last7', start: initial.start, end: initial.end });
  const [department, setDepartment] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [status, setStatus] = useState('completed|active');
  const [isAdmin, setIsAdmin] = useState(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);

  // Data states
  const [kpis, setKpis] = useState(null);
  const [trend, setTrend] = useState([]);
  const [byDept, setByDept] = useState([]);
  const [byOrg, setByOrg] = useState([]);
  const [terms, setTerms] = useState({ accepted: 0, notAccepted: 0, acceptedPct: null });

  // Compute params for API
  const apiParams = useMemo(() => {
    const from = range.start;
    const to = range.end;
    return buildParams({
      from, to,
      granularity,
      organization_id: organizationId,
      status,
      is_admin: isAdmin,
      search: debouncedSearch
    });
  }, [granularity, organizationId, status, isAdmin, range.start, range.end, debouncedSearch]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [kpi, t, dept, org, acpt] = await Promise.all([
          fetchKpiSummarySafe(apiParams),
          fetchActiveTrend(apiParams),
          fetchByDepartmentSafe({ ...apiParams, department }), // department filter is client-only in fallback
          fetchByOrganizationSafe(apiParams),
          fetchTermsAcceptanceSafe(apiParams)
        ]);
        if (!mounted) return;
        setKpis(kpi);
        const tItems = Array.isArray(t?.items) ? t.items : Array.isArray(t) ? t : [];
        setTrend(tItems.map(d => ({ date: d.date || d.bucket || d.label, total: d.total || d.count || 0 })));
        setByDept(Array.isArray(dept) ? dept : Array.isArray(dept?.items) ? dept.items : []);
        setByOrg(Array.isArray(org) ? org : Array.isArray(org?.items) ? org.items : []);
        setTerms(acpt || { accepted: 0, notAccepted: 0, acceptedPct: null });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to load analytics', e);
      }
    }
    load();
    return () => { mounted = false; };
  }, [apiParams, department]);

  // Range presets
  function applyPreset(preset) {
    const now = new Date();
    let start = new Date();
    if (preset === 'last7') start = new Date(now.getTime() - 7 * 86400000);
    if (preset === 'last30') start = new Date(now.getTime() - 30 * 86400000);
    if (preset === 'last90') start = new Date(now.getTime() - 90 * 86400000);
    setRange({ preset, start, end: now });
  }

  // Pie data
  const pieData = useMemo(() => ([
    { name: 'Accepted', value: terms.accepted || 0 },
    { name: 'Not Accepted', value: terms.notAccepted || 0 }
  ]), [terms]);

  return (
    <div className="ua-container">
      <div className="ua-header">
        <h2>Users Analytics</h2>
        <div className="ua-filters">
          <div className="ua-filter">
            <label>Granularity</label>
            <select value={granularity} onChange={e => setGranularity(e.target.value)}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div className="ua-filter">
            <label>Date Range</label>
            <div className="ua-preset-group">
              <button className={`ua-btn ${range.preset === 'last7' ? 'active' : ''}`} onClick={() => applyPreset('last7')}>Last 7</button>
              <button className={`ua-btn ${range.preset === 'last30' ? 'active' : ''}`} onClick={() => applyPreset('last30')}>Last 30</button>
              <button className={`ua-btn ${range.preset === 'last90' ? 'active' : ''}`} onClick={() => applyPreset('last90')}>Last 90</button>
            </div>
          </div>
          <div className="ua-filter">
            <label>Organization</label>
            <input placeholder="organization_id" value={organizationId} onChange={e => setOrganizationId(e.target.value)} />
          </div>
          <div className="ua-filter">
            <label>Department</label>
            <input placeholder="department" value={department} onChange={e => setDepartment(e.target.value)} />
          </div>
          <div className="ua-filter">
            <label>Status</label>
            <input placeholder="completed|active" value={status} onChange={e => setStatus(e.target.value)} />
          </div>
          <div className="ua-filter">
            <label>Admin only</label>
            <select value={isAdmin === null ? '' : isAdmin ? '1' : '0'} onChange={e => setIsAdmin(e.target.value === '' ? null : e.target.value === '1')}>
              <option value="">All</option>
              <option value="1">Admins</option>
              <option value="0">Non-admins</option>
            </select>
          </div>
          <div className="ua-filter ua-search">
            <label>Search</label>
            <input placeholder="name or email" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="ua-kpis">
        <KpiCard title="Active Users Today" value={kpis?.dau ?? '-'} subtitle="DAU" accent="primary" />
        <KpiCard title="Weekly Active Users" value={kpis?.wau ?? '-'} subtitle="WAU (last 7 days)" accent="secondary" />
        <KpiCard title="Monthly Active Users" value={kpis?.mau ?? '-'} subtitle="MAU (last 30 days)" accent="success" />
        <KpiCard title="New Users" value={kpis?.newUsers ?? '-'} subtitle="Over selected period" accent="primary" />
        <KpiCard title="% Accepted Terms" value={kpis?.termsAcceptedPct ?? (terms.acceptedPct != null ? `${terms.acceptedPct}%` : '-')} subtitle="Compliance" accent="secondary" />
      </div>

      <div className="ua-grid">
        <div className="ua-card chart">
          <div className="ua-card-title">Active Users Trend</div>
          <div className="ua-chart">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={formatDateLabel} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="total" name="Active Users" stroke="#2563EB" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="ua-card chart">
          <div className="ua-card-title">Activity by Department</div>
          <div className="ua-chart">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byDept}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="department" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" name="Users" fill="#F59E0B" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="ua-card chart">
          <div className="ua-card-title">Activity by Organization</div>
          <div className="ua-chart">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byOrg}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="organization_name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="activity" name="Active Users" fill="#2563EB" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="ua-card chart">
          <div className="ua-card-title">Terms Acceptance</div>
          <div className="ua-chart">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
