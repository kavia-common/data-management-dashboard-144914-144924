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
import { buildOverviewFilterParams } from '../../api/buildOverviewFilterParams';
import { getOverviewProjectsSummary } from '../../api/overviewAnalytics';

/**
 * PUBLIC_INTERFACE
 * SessionsCreatedBarChart
 * Displays sessions created over time, with tenant-aware behavior:
 * - Debounced API calls per filter change (150ms)
 * - Always sends `range`; includes start/end only when range=custom
 * - For T0000 (super-admin) with barData, renders horizontal bar chart aggregated by tenant
 * - For regular tenants, renders time-bucketed vertical bar chart
 */
export default function SessionsCreatedBarChart() {
  const organizationId = useCurrentOrgId();
  const [range, setRange] = useState('daily');
  const [pendingStart, setPendingStart] = useState('');
  const [pendingEnd, setPendingEnd] = useState('');
  const [appliedStart, setAppliedStart] = useState('');
  const [appliedEnd, setAppliedEnd] = useState('');

  const [status, setStatus] = useState('idle'); // idle | loading | success | empty | error
  const [error, setError] = useState(null);
  const [buckets, setBuckets] = useState([]);
  const [barData, setBarData] = useState([]); // super-admin horizontal data

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

    const params = { range };
    if (range === 'custom' && appliedStart && appliedEnd) {
      params.start_date = appliedStart;
      params.end_date = appliedEnd;
    }

    try {
      const req = buildOverviewFilterParams({ organizationId, params });
      // Reuse overview projects summary endpoint which returns buckets and optional barData for T0000
      const res = await getOverviewProjectsSummary(req);
      const list = Array.isArray(res?.buckets) ? res.buckets : [];
      const incomingBar = Array.isArray(res?.barData) ? res.barData : [];
      const hasAny = (list && list.length > 0) || (incomingBar && incomingBar.length > 0);

      if (!hasAny) {
        setBuckets([]);
        setBarData([]);
        setStatus('empty');
      } else {
        setBuckets(list);

        // Preserve existing sort order (descending by count)
        let sorted = incomingBar
          .slice()
          .sort((a, b) => Number(b?.count || 0) - Number(a?.count || 0));

        // For non-T0000 tenants, filter out zero-count entries for Sessions Created chart (barData)
        const isT0000Local = String(organizationId) === 'T0000';
        if (!isT0000Local) {
          sorted = sorted.filter((item) => Number(item?.count || 0) > 0);
        }

        setBarData(sorted);
        setStatus('success');
      }
    } catch (e) {
      setError(e?.message || 'Failed to load sessions summary.');
      setStatus('error');
    }
  }, [organizationId, range, appliedStart, appliedEnd]);

  // Centralized debounced effect controlling all fetches
  useEffect(() => {
    // On initial mount, fetch once
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      fetchSummary();
      return;
    }

    // Reset custom when changing away from custom
    if (range !== 'custom') {
      if (appliedStart || appliedEnd) {
        setAppliedStart('');
        setAppliedEnd('');
      }
    } else {
      // For custom, only fetch when both applied dates are set
      if (!(appliedStart && appliedEnd)) {
        return;
      }
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      fetchSummary();
    }, 150);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [range, appliedStart, appliedEnd, fetchSummary]);

  const onApplyCustom = () => {
    if (pendingStart && pendingEnd) {
      setAppliedStart(pendingStart);
      setAppliedEnd(pendingEnd);
    }
  };

  // Time-bucketed chart shape for non-super-admin
  const chartData = useMemo(() => {
    const isT0000Local = String(organizationId) === 'T0000';
    const shaped = (buckets || []).map((b) => ({
      label: b.label || b.key,
      count: Number(b.count || 0),
    }));
    return isT0000Local ? shaped : shaped.filter((d) => d.count > 0);
  }, [buckets, organizationId]);

  // Horizontal bar chart data for T0000 + barData (map to { label, total })
  const t0000Data = useMemo(
    () =>
      (barData || []).map((d, i) => ({
        label: String(d.name || d.organization_id || `Tenant ${i + 1}`),
        total: Number(d.count || 0),
      })),
    [barData]
  );

  const isEmpty = status === 'empty';
  const isT0000 = String(organizationId) === 'T0000';
  const shouldShowT0000Horizontal = isT0000 && Array.isArray(t0000Data) && t0000Data.length > 0;

  return (
    <Card style={{ marginTop: 16, overflow: 'visible' }}>
      <div className="overview-users-summary__header project summary" style={{ marginBottom: 8 }}>
        <h3 className="overview-users-summary__title">Sessions Created</h3>
        <div className="overview-users-summary__controls">
          <label htmlFor="sessions-range" className="overview-users-summary__label">
            Range
          </label>
          <select
            id="sessions-range"
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
              <label htmlFor="sessions-start" className="overview-users-summary__label">
                Start
              </label>
              <input
                id="sessions-start"
                type="date"
                className="overview-users-summary__date-input"
                value={pendingStart}
                onChange={(e) => setPendingStart(e.target.value)}
              />
              <label htmlFor="sessions-end" className="overview-users-summary__label">
                End
              </label>
              <input
                id="sessions-end"
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
        <div style={{ padding: 16, color: '#6b7280' }}>No sessions for the selected range.</div>
      )}

      {status === 'success' && !isEmpty && (
        <>
          {shouldShowT0000Horizontal ? (
            <div style={{ width: '100%', height: 320, overflow: 'visible' }} aria-label="Sessions created by tenant">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={t0000Data}
                  layout="vertical"
                  margin={{ top: 12, right: 16, left: 12, bottom: 18 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tick={{ fill: '#ffffff', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: '#ffffff' }}
                    width={140}
                  />
                  <XAxis
                    type="number"
                    tick={{ fill: '#ffffff', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: '#ffffff' }}
                    allowDecimals={false}
                    domain={[0, 'dataMax']}
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
                  <Bar dataKey="total" name="Sessions" fill="#FF6600" radius={[0, 4, 4, 0]}>
                    <LabelList dataKey="total" position="right" fill="#ffffff" fontSize={11} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12, fill: isT0000 ? '#ffffff' : theme.primary }}
                    axisLine={{ stroke: isT0000 ? '#ffffff' : theme.axisTick }}
                    tickLine={{ stroke: isT0000 ? '#ffffff' : theme.axisTick }}
                    interval="preserveEnd"
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12, fill: isT0000 ? '#ffffff' : theme.axisTick }}
                    axisLine={{ stroke: isT0000 ? '#ffffff' : theme.axisTick }}
                    tickLine={{ stroke: isT0000 ? '#ffffff' : theme.axisTick }}
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
                  <Legend />
                  <Bar dataKey="count" name="Sessions" fill={isT0000 ? '#ffffff' : theme.primary} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

SessionsCreatedBarChart.propTypes = {
  // No external props currently; defined for forward compatibility
};
