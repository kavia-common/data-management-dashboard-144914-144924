import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
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
import useCurrentOrgId from '../../hooks/useCurrentOrgId';
import Card from '../common/Card';
import './overview.css';
import '../overview/overviewUsersSummary.css';
import { getChartTheme } from '../charts/chartTheme';

/**
 * PUBLIC_INTERFACE
 * ProjectsServiceTypeBarChart
 * Renders a bar chart of Session counts grouped by service_type with range filtering:
 * - range options: daily | weekly | monthly | custom (default: daily)
 * - when custom, show start/end date inputs and apply only on "Apply"
 * Frontend-only component fetching from backend /api/service-type/summary.
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

  // Stable debounced fetch using a ref-held timeout
  const debounceRef = useRef(null);
  const hasMountedRef = useRef(false);

  const fetchSummary = useCallback(async () => {
    if (!organizationId) return;
    setStatus('loading');
    setError(null);

    const params = new URLSearchParams();
    params.set('range', range || 'daily');
    if (range === 'custom' && appliedStart && appliedEnd) {
      params.set('start_date', appliedStart);
      params.set('end_date', appliedEnd);
    }
    // organization_id is required unless T0000/global on backend;
    // always send it to match existing charts' pattern
    params.set('organization_id', organizationId);

    try {
      const res = await fetch(`/api/service-type/summary?${params.toString()}`, {
        headers: {
          'Accept': 'application/json',
        },
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Request failed with ${res.status}`);
      }
      const data = await res.json();
      const list = Array.isArray(data?.items) ? data.items : [];
      const bucketList = Array.isArray(data?.buckets) ? data.buckets : [];
      const any = (list && list.length > 0) || (bucketList && bucketList.length > 0);
      setItems(list);
      setBuckets(bucketList);
      setStatus(any ? 'success' : 'empty');
    } catch (e) {
      setError(e?.message || 'Failed to load service type summary.');
      setStatus('error');
    }
  }, [organizationId, range, appliedStart, appliedEnd]);

  useEffect(() => {
    // On initial mount, fetch once
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      fetchSummary();
      return;
    }

    // Reset custom dates when switching away from custom
    if (range !== 'custom') {
      if (appliedStart || appliedEnd) {
        setAppliedStart('');
        setAppliedEnd('');
      }
    } else {
      // For custom, only fetch after Apply when both dates are set
      if (!(appliedStart && appliedEnd)) {
        return;
      }
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSummary();
    }, 150);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [range, appliedStart, appliedEnd, fetchSummary]);

  const onApplyCustom = () => {
    if (pendingStart && pendingEnd) {
      setAppliedStart(pendingStart);
      setAppliedEnd(pendingEnd);
    }
  };

  // Data for service type distribution chart
  const serviceChartData = useMemo(() => {
    return (items || []).map((d) => ({
      service: String(d.service_type ?? 'Unknown'),
      count: Number(d.count || 0),
    }));
  }, [items]);

  // Data for time series buckets (if needed or for future expansion)
  const timeSeriesData = useMemo(() => {
    return (buckets || []).map((b) => ({
      label: b.label || b.key,
      count: Number(b.count || 0),
    })).filter((d) => d.count > 0);
  }, [buckets]);

  const isEmpty = status === 'empty';

  return (
    <Card style={{ marginTop: 16, overflow: 'visible' }}>
      <div className="overview-users-summary__header service-type summary" style={{ marginBottom: 8 }}>
        <h3 className="overview-users-summary__title">Sessions by Service Type</h3>
        <div className="overview-users-summary__controls">
          <label htmlFor="service-type-range" className="overview-users-summary__label">
            Range
          </label>
          <select
            id="service-type-range"
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
              <label htmlFor="service-type-start" className="overview-users-summary__label">
                Start
              </label>
              <input
                id="service-type-start"
                type="date"
                className="overview-users-summary__date-input"
                value={pendingStart}
                onChange={(e) => setPendingStart(e.target.value)}
              />
              <label htmlFor="service-type-end" className="overview-users-summary__label">
                End
              </label>
              <input
                id="service-type-end"
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

      {status === 'loading' && (
        <div style={{ padding: 16, color: '#6b7280' }}>Loading…</div>
      )}
      {status === 'error' && (
        <div role="alert" style={{ padding: 16, color: '#EF4444' }}>{error}</div>
      )}
      {isEmpty && (
        <div style={{ padding: 16, color: '#6b7280' }}>No sessions found for the selected range.</div>
      )}

      {status === 'success' && !isEmpty && (
        <>
          {/* Primary: distribution by service type */}
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={serviceChartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
                <XAxis
                  dataKey="service"
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
                  labelFormatter={(label) => `Service: ${label}`}
                />
                <Legend />
                <Bar dataKey="count" name="Sessions" fill={theme.primary} radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="count" position="top" fill={theme.primary} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Optional secondary small chart for time series buckets (kept concise) */}
          {timeSeriesData.length > 0 && (
            <div style={{ width: '100%', height: 200, marginTop: 16 }}>
              <ResponsiveContainer>
                <BarChart data={timeSeriesData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: theme.axisTick }}
                    axisLine={{ stroke: theme.axisTick }}
                    tickLine={{ stroke: theme.axisTick }}
                    interval="preserveEnd"
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: theme.axisTick }}
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
                  <Bar dataKey="count" name="Sessions" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

ProjectsServiceTypeBarChart.propTypes = {
  // No external props currently; defined for forward compatibility
};
