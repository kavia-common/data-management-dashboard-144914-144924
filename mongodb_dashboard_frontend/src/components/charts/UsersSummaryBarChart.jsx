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
 * Accepts data = [{ key, label, count }]
 * Safe defaults ensure the container has height even when empty/error.
 */
export default function UsersSummaryBarChart({
  data,
  loading,
  error,
  title = 'Users Created',
  height = 240,
}) {
  // Safe data with normalized keys for Recharts: label -> XAxis, count -> Bar
  const safeData = useMemo(() => {
    const arr = Array.isArray(data) ? data.filter(Boolean) : [];
    return arr.map((d, i) => ({
      key: String(d?.key ?? d?.label ?? `bucket-${i}`),
      label: String(d?.label ?? d?.key ?? `Bucket ${i + 1}`),
      count: Number.isFinite(Number(d?.count)) ? Number(d.count) : 0,
    }));
  }, [data]);

  // Debug: log mapped safe data length and first 3 items
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.debug('[UsersSummaryBarChart] data', {
      length: safeData.length,
      sample: safeData.slice(0, 3),
    });
  }, [safeData]);

  const theme = getChartTheme ? getChartTheme() : {
    primary: '#2563EB',
    grid: '#e5e7eb',
    label: '#374151',
    axisTick: '#9ca3af',
    tooltip: { bg: '#111827', border: '#374151', text: '#F9FAFB' },
  };

  // Pre-calc max for domain to include 0 and avoid hiding bars
  const max = useMemo(() => {
    if (!safeData.length) return 0;
    return Math.max(...safeData.map((d) => d.count));
  }, [safeData]);

  // Error surface with allocated height to keep layout stable
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[UsersSummaryBarChart] rendering with error', error);
    const errMsg = (error && (error.message || error.status || 'Error')) || 'Error';
    return (
      <div className="users-summary-chart users-summary-chart--error" role="alert" aria-live="polite" style={{ minHeight: height }}>
        <div className="users-summary-chart__header">
          {title ? <h3 className="users-summary-chart__title">{title}</h3> : null}
        </div>
        <div className="users-summary-chart__body" title={String(errMsg)}>Error loading data</div>
      </div>
    );
  }

  // Loading state with allocated height so ResponsiveContainer won't collapse
  if (loading) {
    return (
      <div className="users-summary-chart" style={{ minHeight: height }}>
        <div className="users-summary-chart__header">
          {title ? <h3 className="users-summary-chart__title">{title}</h3> : null}
        </div>
        <div className="users-summary-chart__body">
          <div className="users-summary-chart__loading">Loading…</div>
        </div>
      </div>
    );
  }

  // Empty state overlay but keep height for ResponsiveContainer
  const isEmpty = !safeData || safeData.length === 0;

  return (
    <div className="users-summary-chart" style={{ minHeight: height }}>
      <div className="users-summary-chart__header">
        {title ? <h3 className="users-summary-chart__title">{title}</h3> : null}
      </div>

      {/*
        The chart MUST mount inside .users-summary-chart__body and that element
        must provide a definite height so ResponsiveContainer can compute sizes.
        We keep a minHeight here, but allow CSS to override if parent wants.
      */}
      <div
        className="users-summary-chart__body"
        style={{ width: '100%', minHeight: height - 40, position: 'relative' }}
      >
        {isEmpty ? (
          // Keep the reserved space so layout remains stable while showing fallback
          <>
            <div style={{ width: '100%', height: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                {/* Render an empty BarChart with empty data so axes render consistently */}
                <BarChart data={[]} margin={{ top: 8, right: 16, left: 8, bottom: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
                  <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: theme.axisTick }} />
                  <YAxis tickLine={false} axisLine={{ stroke: theme.axisTick }} allowDecimals={false} domain={[0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="users-summary-chart__empty" aria-live="polite">No data</div>
          </>
        ) : (
          <ResponsiveContainer className="users-summary-chart__responsive" width="100%" height="100%">
            <BarChart
              data={safeData}
              margin={{ top: 8, right: 16, left: 8, bottom: 16 }}
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
                domain={[0, max || 'dataMax']}
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
        )}
      </div>
    </div>
  );
}

UsersSummaryBarChart.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string,
      label: PropTypes.string,
      count: PropTypes.number,
    })
  ),
  loading: PropTypes.bool,
  error: PropTypes.any,
  title: PropTypes.string,
  height: PropTypes.number,
};
