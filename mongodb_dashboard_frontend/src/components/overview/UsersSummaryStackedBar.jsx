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
  // Safe static palette fallback to remove dependency on undefined theme.palette
  const PALETTE = [
    '#2563EB', // blue-600
    '#F59E0B', // amber-500
    '#10B981', // emerald-500
    '#8B5CF6', // violet-500
    '#EF4444', // red-500
    '#14B8A6', // teal-500
    '#F97316', // orange-500
    '#3B82F6', // blue-500
  ];

  // Defensive fallback theme to avoid runtime errors if chartTheme isn't wired
  const theme = getChartTheme
    ? getChartTheme()
    : {
        primary: '#2563EB',
        grid: '#e5e7eb',
        label: '#374151',
        axisTick: '#9ca3af',
        tooltip: { bg: '#111827', border: '#374151', text: '#F9FAFB' },
        palette: PALETTE,
      };

  // Use provided theme.palette if it exists and is a non-empty array; otherwise use PALETTE
  const colors =
    theme && theme.palette && Array.isArray(theme.palette) && theme.palette.length > 0
      ? theme.palette
      : PALETTE;

  // Normalize inputs: always arrays, filter out junk values
  const safeRows = useMemo(() => (Array.isArray(rows) ? rows.filter(Boolean) : []), [rows]);
  const safeOrgs = useMemo(
    () => (Array.isArray(orgs) ? orgs.filter((o) => typeof o === 'string' && o.trim().length > 0) : []),
    [orgs]
  );

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
  const chartData = useMemo(() => {
    if (!Array.isArray(safeRows) || safeRows.length === 0) return [];
    return safeRows.map((r, i) => {
      const base = { label: String(r?.label ?? `Bucket ${i + 1}`) };
      if (!Array.isArray(seriesKeys) || seriesKeys.length === 0) return base;
      for (const key of seriesKeys) {
        const v = Number(r?.[key]);
        base[key] = Number.isFinite(v) ? v : 0;
      }
      return base;
    });
  }, [safeRows, seriesKeys]);

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
      colorsLen: Array.isArray(colors) ? colors.length : 0,
      seriesKeys,
      sampleRow: Array.isArray(safeRows) && safeRows.length > 0 ? safeRows[0] : null,
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
            {Array.isArray(seriesKeys) && seriesKeys.length > 0
              ? seriesKeys.map((org, idx) => {
                  const palette = Array.isArray(colors) && colors.length > 0 ? colors : PALETTE;
                  const color = palette[idx % palette.length];
                  return (
                    <Bar
                      key={org}
                      dataKey={org}
                      stackId="users"
                      name={org}
                      fill={color}
                      radius={[4, 4, 0, 0]}
                    />
                  );
                })
              : null}
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
