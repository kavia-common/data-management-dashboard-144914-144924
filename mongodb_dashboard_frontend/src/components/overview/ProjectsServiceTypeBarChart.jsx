import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  LabelList,
} from 'recharts';
import Card from '../common/Card';
import './overview.css';
import '../overview/overviewUsersSummary.css';
import useCurrentOrgId from '../../hooks/useCurrentOrgId';
import { getChartTheme } from '../charts/chartTheme';

// PUBLIC_INTERFACE
/**
 * ProjectsServiceTypeBarChart
 * - Fetches /api/service-type/summary with daily|weekly|monthly|custom filters.
 * - For custom, shows start/end date inputs and Apply button.
 * - Default filter is daily.
 * - Renders vertical bar chart of counts by service_type; also shows small timeline buckets chart below for context.
 */
export default function ProjectsServiceTypeBarChart() {
  const organizationId = useCurrentOrgId();

  const [range, setRange] = useState('daily');
  const [pendingStart, setPendingStart] = useState('');
  const [pendingEnd, setPendingEnd] = useState('');
  const [appliedStart, setAppliedStart] = useState('');
  const [appliedEnd, setAppliedEnd] = useState('');

  const [status, setStatus] = useState('idle'); // idle | loading | success | empty | error
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]); // [{ service_type, count }]
  const [buckets, setBuckets] = useState([]); // [{ label, count }]

  const theme = getChartTheme ? getChartTheme() : {
    primary: '#2563EB',
    grid: '#e5e7eb',
    label: '#374151',
    axisTick: '#9ca3af',
    tooltip: { bg: '#2b2723', border: '#2b2723', text: '#ffffff' },
    palette: ['#2563EB', '#F59E0B', '#10B981', '#EC4899', '#8B5CF6', '#F43F5E', '#0EA5E9'],
  };

  const debounceRef = useRef(null);
  const hasMountedRef = useRef(false);

  const buildUrl = useCallback(() => {
    const base = '/api/service-type/summary';
    const params = new URLSearchParams();
    if (organizationId) params.set('organization_id', organizationId);
    params.set('range', range);
    if (range === 'custom' && appliedStart && appliedEnd) {
      params.set('start_date', appliedStart);
      params.set('end_date', appliedEnd);
    }
    return `${base}?${params.toString()}`;
  }, [organizationId, range, appliedStart, appliedEnd]);

  const fetchData = useCallback(async () => {
    if (!organizationId) return;

    setStatus('loading');
    setError(null);

    try {
      const url = buildUrl();
      const resp = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          // backend also accepts x-organization-id header
          'x-organization-id': organizationId,
        },
      });
      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(`Failed (${resp.status}): ${t || 'Unknown error'}`);
      }
      const data = await resp.json();
      const arr = Array.isArray(data?.items) ? data.items : [];
      const bucketsArr = Array.isArray(data?.buckets) ? data.buckets : [];
      if (arr.length === 0 && bucketsArr.length === 0) {
        setItems([]);
        setBuckets([]);
        setStatus('empty');
      } else {
        // Sort by count desc
        const sorted = arr.slice().sort((a, b) => Number(b?.count || 0) - Number(a?.count || 0));
        setItems(sorted);
        setBuckets(bucketsArr);
        setStatus('success');
      }
    } catch (e) {
      setError(e?.message || 'Failed to load service type summary.');
      setStatus('error');
    }
  }, [organizationId, buildUrl]);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      fetchData();
      return;
    }

    if (range !== 'custom') {
      if (appliedStart || appliedEnd) {
        setAppliedStart('');
        setAppliedEnd('');
      }
    } else if (!(appliedStart && appliedEnd)) {
      // wait for both to apply before fetching
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchData(), 150);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [range, appliedStart, appliedEnd, fetchData]);

  const onApplyCustom = () => {
    if (pendingStart && pendingEnd) {
      setAppliedStart(pendingStart);
      setAppliedEnd(pendingEnd);
    }
  };

  const chartData = useMemo(
    () =>
      (items || []).map((d, i) => ({
        label: d.service_type || `Type ${i + 1}`,
        count: Number(d.count || 0),
      })),
    [items]
  );

  const timelineData = useMemo(
    () =>
      (buckets || [])
        .map((b) => ({ label: b.label || b.key, count: Number(b.count || 0) }))
        .filter((d) => d.count > 0),
    [buckets]
  );

  return (
    <Card style={{ marginTop: 16, overflow: 'visible' }}>
      <div className="overview-users-summary__header project summary" style={{ marginBottom: 8 }}>
        <h3 className="overview-users-summary__title">Sessions by Service Type</h3>
        <div className="overview-users-summary__controls">
          <label htmlFor="svc-range" className="overview-users-summary__label">Range</label>
          <select
            id="svc-range"
            className="overview-users-summary__select"
            value={range}
            onChange={(e) => setRange(e.target.value)}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="custom">Custom</option>
          </select>

          {range === 'custom' && (
            <>
              <label htmlFor="svc-start" className="overview-users-summary__label">Start</label>
              <input
                id="svc-start"
                type="date"
                className="overview-users-summary__date-input"
                value={pendingStart}
                onChange={(e) => setPendingStart(e.target.value)}
              />
              <label htmlFor="svc-end" className="overview-users-summary__label">End</label>
              <input
                id="svc-end"
                type="date"
                className="overview-users-summary__date-input"
                value={pendingEnd}
                onChange={(e) => setPendingEnd(e.target.value)}
              />
              <button
                onClick={onApplyCustom}
                disabled={!pendingStart || !pendingEnd}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: `1px solid ${theme.primary}`,
                  background: theme.primary,
                  color: '#fff',
                  cursor: (!pendingStart || !pendingEnd) ? 'not-allowed' : 'pointer',
                }}
              >
                Apply
              </button>
            </>
          )}
        </div>
      </div>

      {status === 'loading' && <div style={{ padding: 16, color: '#6b7280' }}>Loading…</div>}
      {status === 'error' && <div role="alert" style={{ padding: 16, color: '#EF4444' }}>{error}</div>}
      {status === 'empty' && <div style={{ padding: 16, color: '#6b7280' }}>No data for the selected range.</div>}

      {status === 'success' && (
        <>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: theme.primary }}
                  axisLine={{ stroke: theme.axisTick }}
                  tickLine={{ stroke: theme.axisTick }}
                  interval="preserveEnd"
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: theme.axisTick }}
                  axisLine={{ stroke: theme.axisTick }}
                  tickLine={{ stroke: theme.axisTick }}
                />
                <Tooltip
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{
                    background: '#2b2723',
                    border: 'none',
                    borderRadius: 8,
                    color: '#ffffff',
                  }}
                  wrapperStyle={{ zIndex: 9999 }}
                  formatter={(value) => [value, 'Sessions']}
                  labelFormatter={(label) => `${label}`}
                />
                <Legend />
                <Bar dataKey="count" name="Sessions" fill={theme.primary} radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="count" position="top" fill={theme.label} fontSize={11} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Optional small time-bucket trend for context */}
          {timelineData.length > 0 && (
            <div style={{ width: '100%', height: 160, marginTop: 16 }}>
              <ResponsiveContainer>
                <BarChart data={timelineData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: theme.axisTick }}
                    axisLine={{ stroke: theme.axisTick }}
                    tickLine={{ stroke: theme.axisTick }}
                    interval="preserveEnd"
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 10, fill: theme.axisTick }}
                    axisLine={{ stroke: theme.axisTick }}
                    tickLine={{ stroke: theme.axisTick }}
                  />
                  <Tooltip
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{
                      background: '#2b2723',
                      border: 'none',
                      borderRadius: 8,
                      color: '#ffffff',
                    }}
                    wrapperStyle={{ zIndex: 9999 }}
                    formatter={(value) => [value, 'Sessions']}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Bar dataKey="count" name="Total" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
