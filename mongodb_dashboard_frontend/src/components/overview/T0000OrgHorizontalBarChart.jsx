import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { getChartTheme } from '../charts/chartTheme';

/**
 * PUBLIC_INTERFACE
 * T0000OrgHorizontalBarChart
 * A horizontal bar chart used only for organization_id === 'T0000'.
 * Expects data in the shape: [{ name: <organization_name>, value: <count_or_metric> }]
 * Styling follows existing chart theme and patterns.
 */
export default function T0000OrgHorizontalBarChart({
  data = [],
  loading = false,
  error = '',
  title = 'Projects Created by Organization',
  height = 320,
}) {
  const t = getChartTheme();

  const normalized = useMemo(() => {
    const arr = Array.isArray(data) ? data : [];
    // Ensure required keys and numeric value
    return arr.map((d, i) => ({
      name: String(d?.name ?? `Org ${i + 1}`),
      value: Number.isFinite(Number(d?.value)) ? Number(d.value) : 0,
    }));
  }, [data]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const item = payload[0];
      const count = item?.value ?? 0;
      return (
        <div
          role="dialog"
          aria-live="polite"
          style={{
            background: t.tooltip.bg,
            border: `1px solid ${t.tooltip.border}`,
            borderRadius: 8,
            padding: '8px 10px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            color: t.tooltip.text,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
          <div>Projects: {count}</div>
        </div>
      );
    }
    return null;
  };

  if (error) {
    return (
      <div style={{ width: '100%', height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b91c1c' }} role="alert">
        {String(error)}
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ width: '100%', height, display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-busy="true">
        Loading chart...
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height }} role="img" aria-label="Horizontal bar chart of projects created by organization">
      {title ? (
        <div style={{ marginBottom: 8 }}>
          <h3 style={{ fontSize: 14, margin: 0 }}>{title}</h3>
        </div>
      ) : null}
      {(Array.isArray(normalized) ? normalized.length : 0) === 0 ? (
        <div style={{ width: '100%', height: height - 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
          No data
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={normalized}
            margin={{ top: 8, right: 24, bottom: 8, left: 24 }}
            barCategoryGap={14}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={t.grid} />
            <XAxis
              type="number"
              tick={{ fontSize: 12, fill: t.axisTick }}
              axisLine={{ stroke: t.axisTick }}
              tickLine={false}
              allowDecimals={false}
              domain={[0, 'dataMax']}
            />
            <YAxis
              dataKey="name"
              type="category"
              tick={{ fontSize: 12, fill: t.axisTick }}
              axisLine={{ stroke: t.axisTick }}
              tickLine={false}
              width={140}
            />
            <Tooltip
              content={<CustomTooltip />}
              wrapperStyle={{ outline: 'none' }}
            />
            <Legend
              verticalAlign="top"
              height={24}
              wrapperStyle={{ fontSize: 12, color: t.legend.text }}
            />
            <Bar
              dataKey="value"
              name="Projects"
              fill={t.primary}
              stroke={t.primary}
              radius={[0, 4, 4, 0]}
              aria-label="Projects count"
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

T0000OrgHorizontalBarChart.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string,
      value: PropTypes.number,
    })
  ),
  loading: PropTypes.bool,
  error: PropTypes.any,
  title: PropTypes.string,
  height: PropTypes.number,
};
