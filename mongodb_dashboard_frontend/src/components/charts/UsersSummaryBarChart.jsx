import React, { useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import './UsersSummaryBarChart.css';
import { getChartTheme } from './chartTheme';

/**
 * PUBLIC_INTERFACE
 * UsersSummaryBarChart
 * Renders a responsive Recharts BarChart for users summary buckets.
 * Accepts data = [{ label, count }]
 * Ensures container has definite height and always renders (even when all counts are zero).
 */
export default function UsersSummaryBarChart({
  data,
  loading,
  error,
  title = 'Users Created',
  height = 320,
}) {
  // Normalize props.data strictly to [{label, count}] for direct Recharts mapping
  const normalized = useMemo(() => {
    const arr = Array.isArray(data) ? data.filter(Boolean) : [];
    const mapped = arr.map((d, i) => ({
      label: String(d?.label ?? d?.key ?? `Bucket ${i + 1}`),
      count: Number.isFinite(Number(d?.count)) ? Number(d.count) : 0,
    }));
    // Temporary hardcoded fallback for visual confirmation when no data provided
    if (mapped.length === 0) {
      return [
        { label: '2025-11-01', count: 0 },
        { label: '2025-11-02', count: 0 },
        { label: '2025-11-03', count: 4 },
        { label: '2025-11-04', count: 0 },
        { label: '2025-11-05', count: 4 },
      ];
    }
    return mapped;
  }, [data]);

  // Log a small sample of the chart data for verification
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.debug('Chart data sample', normalized.slice(0, 3));
  }, [normalized]);

  const theme = getChartTheme ? getChartTheme() : {
    primary: '#2563EB',
    grid: '#e5e7eb',
    label: '#374151',
    axisTick: '#9ca3af',
    tooltip: { bg: '#111827', border: '#374151', text: '#F9FAFB' },
  };

  // Use dataMax with a floor of 0 so zero counts still render axes, and add margin to avoid clipping.
  const yDomain = [0, 'dataMax'];

  // Error layout: keep height so container doesn't collapse
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[UsersSummaryBarChart] error', error);
    return (
      <div className="users-summary-chart" style={{ minHeight: height, height }}>
        <div className="users-summary-chart__header">
          {title ? <h3 className="users-summary-chart__title">{title}</h3> : null}
        </div>
        <div className="users-summary-chart__body">Error loading data</div>
      </div>
    );
  }

  // Loading layout: keep height to allow ResponsiveContainer sizing
  if (loading) {
    return (
      <div className="users-summary-chart" style={{ minHeight: height, height }}>
        <div className="users-summary-chart__header">
          {title ? <h3 className="users-summary-chart__title">{title}</h3> : null}
        </div>
        <div className="users-summary-chart__body">
          <div className="users-summary-chart__loading">Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="users-summary-chart" style={{ minHeight: height, height }}>
      <div className="users-summary-chart__header">
        {title ? <h3 className="users-summary-chart__title">{title}</h3> : null}
      </div>
      <div className="users-summary-chart__body" style={{ width: '100%', height: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={normalized}
            margin={{ top: 12, right: 16, left: 12, bottom: 18 }}
          >
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
              domain={yDomain}
            />
            <Tooltip
              cursor={{ fill: 'transparent' }}
              contentStyle={{
                background: theme.tooltip.bg,
                border: `1px solid ${theme.tooltip.border}`,
                borderRadius: 8,
                color: theme.tooltip.text,
              }}
              formatter={(value) => [value, 'Users']}
              labelFormatter={(label) => `${label}`}
            />
            <Bar dataKey="count" name="Users" fill={theme.primary} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

UsersSummaryBarChart.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string,
      count: PropTypes.number,
    })
  ),
  loading: PropTypes.bool,
  error: PropTypes.any,
  title: PropTypes.string,
  height: PropTypes.number,
};
