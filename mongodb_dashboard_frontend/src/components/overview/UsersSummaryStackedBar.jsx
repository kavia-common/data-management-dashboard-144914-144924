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
  const series = useMemo(() => (Array.isArray(orgs) ? orgs.filter(Boolean) : []), [orgs]);
  const data = useMemo(() => (Array.isArray(rows) ? rows : []), [rows]);

  const isProd = (process.env.REACT_APP_NODE_ENV || process.env.NODE_ENV) === 'production';
  if (!isProd) {
    // eslint-disable-next-line no-console
    console.debug('[UsersSummaryStackedBar] debug', {
      loading: !!loading,
      hasError: !!error,
      buckets: (data || []).length,
      series: (series || []).length,
      orgKeys: series,
      sample: (data || []).slice(0, 2),
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
  const hasData = (data || []).length > 0 && (series || []).length > 0;
  if (!hasData) {
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
          <BarChart data={data} margin={{ top: 12, right: 16, left: 12, bottom: 18 }}>
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
            {(series || []).map((org, idx) => (
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
