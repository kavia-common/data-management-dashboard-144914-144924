import React, { useMemo } from 'react';
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
} from 'recharts';
import { getChartTheme } from '../charts/chartTheme';

/**
 * PUBLIC_INTERFACE
 * UsersSummaryStackedBar
 * Supports two modes:
 *  - Totals (T0000): rows = [{ label, total }] => renders a horizontal single-series bar (layout='vertical').
 *  - Stacked (per-bucket): rows = [{ label, <orgKey>: number, ... }], orgs = ['orgKey', ...]
 */
export default function UsersSummaryStackedBar({ rows, orgs, loading, error, height = 280 }) {
  // Defensive fallback theme to avoid runtime errors if chartTheme isn't wired
  const theme = getChartTheme ? getChartTheme() : {
    primary: '#2563EB',
    grid: '#e5e7eb',
    label: '#374151',
    axisTick: '#9ca3af',
    tooltip: { bg: '#111827', border: '#374151', text: '#F9FAFB' },
    palette: ['#2563EB', '#F59E0B', '#10B981', '#EC4899', '#8B5CF6', '#F43F5E', '#0EA5E9'],
  };

  // Normalize inputs: always arrays, filter out junk values
  const safeRows = useMemo(() => (Array.isArray(rows) ? rows.filter(Boolean) : []), [rows]);
  const safeOrgs = useMemo(
    () => (Array.isArray(orgs) ? orgs.filter((o) => typeof o === 'string' && o.trim().length > 0) : []),
    [orgs]
  );

  // Detect totals mode: row objects only contain {label, total} or explicitly provided 'total' key
  const isTotalsMode = useMemo(() => {
    if (!Array.isArray(safeRows) || safeRows.length === 0) return false;
    // If every row has a numeric 'total', consider totals mode
    return safeRows.every((r) => Number.isFinite(Number(r?.total)));
  }, [safeRows]);

  // Derive seriesKeys from union of keys in rows if orgs not provided (stacked mode only)
  const seriesKeys = useMemo(() => {
    if (isTotalsMode) return []; // not needed
    if (Array.isArray(safeOrgs) && safeOrgs.length > 0) return safeOrgs;
    // collect keys present in rows besides 'label'
    const s = new Set();
    for (const r of safeRows) {
      if (r && typeof r === 'object') {
        Object.keys(r).forEach((k) => {
          if (k !== 'label') s.add(k);
        });
      }
    }
    return Array.from(s);
  }, [safeOrgs, safeRows, isTotalsMode]);

  // Final chart data (guarded, per mode)
  const chartData = useMemo(() => {
    if (!Array.isArray(safeRows) || safeRows.length === 0) return [];
    // Totals mode: ensure objects are { label, total }
    if (isTotalsMode) {
      return safeRows.map((r, i) => ({
        label: String(r?.label ?? `Item ${i + 1}`),
        total: Number.isFinite(Number(r?.total)) ? Number(r.total) : 0,
      }));
    }
    // Stacked mode
    return safeRows.map((r, i) => {
      const base = { label: String(r?.label ?? `Bucket ${i + 1}`) };
      if (!Array.isArray(seriesKeys) || seriesKeys.length === 0) return base;
      for (const key of seriesKeys) {
        const v = Number(r?.[key]);
        base[key] = Number.isFinite(v) ? v : 0;
      }
      return base;
    });
  }, [safeRows, seriesKeys, isTotalsMode]);

  const isProd = (process.env.REACT_APP_NODE_ENV || process.env.NODE_ENV) === 'production';
  if (!isProd) {
    // eslint-disable-next-line no-console
    console.debug('[UsersSummaryStackedBar] debug', {
      loading: !!loading,
      hasError: !!error,
      rowsProvided: Array.isArray(rows),
      orgsProvided: Array.isArray(orgs),
      rowsLen: Array.isArray(safeRows) ? safeRows.length : 0,
      orgsLen: Array.isArray(safeOrgs) ? safeOrgs.length : 0,
      seriesKeysLen: Array.isArray(seriesKeys) ? seriesKeys.length : 0,
      seriesKeys,
      sampleRow: safeRows[0] || null,
      mode: isTotalsMode ? 'totals' : 'stacked',
    });
  }

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[UsersSummaryStackedBar] error', error);
  }

  // Early return placeholders for stability and to guarantee height for ResponsiveContainer
  if (loading) {
    return (
      <div className="users-summary-chart" style={{ minHeight: height, height }}>
        <div className="users-summary-chart__body">Loading…</div>
      </div>
    );
  }

  const hasRows = Array.isArray(chartData) && chartData.length > 0;
  if (!hasRows) {
    return (
      <div className="users-summary-chart" style={{ minHeight: height, height }}>
        <div className="users-summary-chart__body" />
      </div>
    );
  }

  // Totals mode: horizontal bar (layout='vertical'), single series total, orange color
  if (isTotalsMode) {
    return (
      <div className="users-summary-chart" style={{ minHeight: height, height }}>
        <div className="users-summary-chart__body" style={{ width: '100%', height: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 12, right: 16, left: 12, bottom: 18 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
              <YAxis
                type="category"
                dataKey="label"
                tick={{ fill: theme.label, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: theme.axisTick }}
                width={120}
              />
              <XAxis
                type="number"
                tick={{ fill: theme.label, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: theme.axisTick }}
                allowDecimals={false}
                domain={[0, 'dataMax']}
              />
              <Tooltip
                cursor={{ fill: 'transparent' }}
                contentStyle={{
                  background: theme.tooltip.bg,
                  border: `1px solid ${theme.tooltip.border}`,
                  borderRadius: 8,
                  color: theme.tooltip.text,
                }}
                formatter={(value) => [value, 'Total']}
                labelFormatter={(label) => `${label}`}
              />
              <Bar dataKey="total" name="Total" fill="#FF6600" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  // Stacked mode (existing behavior)
  const hasSeries = Array.isArray(seriesKeys) && seriesKeys.length > 0;
  if (!hasSeries) {
    return (
      <div className="users-summary-chart" style={{ minHeight: height, height }}>
        <div className="users-summary-chart__body" />
      </div>
    );
  }

  return (
    <div className="users-summary-chart" style={{ minHeight: height, height }}>
      <div className="users-summary-chart__body" style={{ width: '100%', height: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 12, right: 16, left: 12, bottom: 18 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
            <XAxis
              dataKey="label"
              tick={{ fill: theme.label, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: theme.axisTick }}
              minTickGap={18}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: theme.label, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: theme.axisTick }}
              allowDecimals={false}
              domain={[0, 'dataMax']}
            />
            <Tooltip
              cursor={{ fill: 'transparent' }}
              contentStyle={{
                background: theme.tooltip.bg,
                border: `1px solid ${theme.tooltip.border}`,
                borderRadius: 8,
                color: theme.tooltip.text,
              }}
              formatter={(value, name) => [value, String(name)]}
              labelFormatter={(label) => `${label}`}
            />
            <Legend />
            {seriesKeys.map((org, idx) => (
              <Bar
                key={org}
                dataKey={org}
                stackId="users"
                name={org}
                fill={theme.palette[idx % theme.palette.length]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

UsersSummaryStackedBar.propTypes = {
  rows: PropTypes.arrayOf(PropTypes.object),
  orgs: PropTypes.arrayOf(PropTypes.string),
  loading: PropTypes.bool,
  error: PropTypes.any,
  height: PropTypes.number,
};
