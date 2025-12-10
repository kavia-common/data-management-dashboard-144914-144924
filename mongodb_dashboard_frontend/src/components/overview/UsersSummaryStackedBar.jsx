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
 * Renders a stacked BarChart for per-organization users counts across date buckets.
 * rows: [{ label: 'YYYY-MM-DD', <org1>: number, <org2>: number, ... }]
 * orgs: ['orgA','orgB',...]
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

  // Normalize inputs: always arrays
  const safeRows = useMemo(() => (Array.isArray(rows) ? rows : []), [rows]);
  const safeOrgs = useMemo(() => (Array.isArray(orgs) ? orgs.filter(Boolean) : []), [orgs]);

  // Derive seriesKeys from union of keys in rows if orgs not provided
  const seriesKeys = useMemo(() => {
    if (safeOrgs.length > 0) return safeOrgs;
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
  }, [safeOrgs, safeRows]);

  // Final chart data (guarded)
  const chartData = useMemo(() => safeRows.map((r, i) => ({
    label: String(r?.label ?? `Bucket ${i + 1}`),
    ...seriesKeys.reduce((acc, key) => {
      const v = Number(r?.[key]);
      acc[key] = Number.isFinite(v) ? v : 0;
      return acc;
    }, {}),
  })), [safeRows, seriesKeys]);

  const isProd = (process.env.REACT_APP_NODE_ENV || process.env.NODE_ENV) === 'production';
  if (!isProd) {
    // eslint-disable-next-line no-console
    console.debug('[UsersSummaryStackedBar] debug', {
      loading: !!loading,
      hasError: !!error,
      rowsProvided: Array.isArray(rows),
      orgsProvided: Array.isArray(orgs),
      rowsLen: safeRows.length,
      orgsLen: safeOrgs.length,
      seriesKeysLen: seriesKeys.length,
      seriesKeys,
      sampleRow: safeRows[0] || null,
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

  // If no data or no series, render an empty-state container to avoid recharts mapping on undefined
  const hasSeries = Array.isArray(seriesKeys) && seriesKeys.length > 0;
  const hasRows = Array.isArray(chartData) && chartData.length > 0;
  if (!hasSeries || !hasRows) {
    return (
      <div className="users-summary-chart" style={{ minHeight: height, height }}>
        <div className="users-summary-chart__body" />
      </div>
    );
  }

  // Compute dynamic Bars from provided series; keep domain safe
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
