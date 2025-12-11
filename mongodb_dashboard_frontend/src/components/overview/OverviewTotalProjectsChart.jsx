import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

/**
// PUBLIC_INTERFACE
 * OverviewTotalProjectsChart
 * Renders total projects per project as a bar chart.
 * - X axis shows project_name (or project_id fallback).
 * - Tooltip shows project_name, project_id and count.
 * Props:
 *  - data: array of buckets: { project_id, project_name, count, days? }
 *  - range: string
 *  - height: number
 *  - loading: bool
 *  - error: any
 */
export default function OverviewTotalProjectsChart({ data = [], range = 'daily', height = 280, loading, error }) {
  const containerStyle = {
    width: '100%',
    height,
    background: '#ffffff',
    borderRadius: 12,
    boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
    border: '1px solid #e5e7eb',
    padding: 12,
    display: 'flex',
  };

  const chartData = useMemo(() => {
    if (!Array.isArray(data)) return [];
    const mapped = data.map((row) => {
      const label = row.project_name || row.project_id || 'unknown';
      return {
        label,
        count: typeof row.count === 'number' ? row.count : (typeof row.total === 'number' ? row.total : 0),
        project_id: row.project_id,
        project_name: row.project_name || null,
      };
    });
    // Already sorted by backend; preserve order.
    return mapped;
  }, [data]);

  if (error) {
    return (
      <div role="alert" style={{ ...containerStyle, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#EF4444' }}>Failed to load projects data.</div>
      </div>
    );
  }
  if (loading) {
    return (
      <div aria-busy="true" style={{ ...containerStyle, alignItems: 'center', justifyContent: 'center', opacity: 0.8 }}>
        Loading projects…
      </div>
    );
  }
  if (!chartData.length) {
    return (
      <div style={{ ...containerStyle, alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
        No project activity for the selected range.
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0]?.payload;
      return (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{item?.project_name || item?.label}</div>
          <div style={{ marginBottom: 4, fontSize: 12, color: '#6b7280' }}>Project ID: {item?.project_id}</div>
          <div>Sessions: <strong>{item?.count ?? payload[0].value}</strong></div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="overview-card" aria-label="Total Projects by project" style={{ width: '100%' }}>
      <h3 className="overview-card-title">Total Projects</h3>
      <div className="overview-chart-wrapper" role="img" aria-describedby="total-projects-desc" style={{ width: '100%' }}>
        <p id="total-projects-desc" className="sr-only">
          Bar chart showing the number of sessions per project, labeled by project name.
        </p>
        <ResponsiveContainer width="100%" height={height - 60}>
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 20, bottom: 20, left: 10 }}
            barCategoryGap="20%"
          >
            <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: '#111827' }}
              interval="preserveStartEnd"
              minTickGap={12}
              height={38}
            />
            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#111827' }} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} wrapperStyle={{ zIndex: 1000 }} />
            <Bar name="Projects" dataKey="count" fill="#2563EB" radius={[4, 4, 0, 0]} isAnimationActive={true} />
            <Legend />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="overview-card-subtitle" aria-live="polite">
        Range: {range}
      </div>
    </div>
  );
}

OverviewTotalProjectsChart.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      project_id: PropTypes.string,
      project_name: PropTypes.string,
      count: PropTypes.number,
      days: PropTypes.array,
    })
  ),
  range: PropTypes.string,
  height: PropTypes.number,
  loading: PropTypes.bool,
  error: PropTypes.any,
};
