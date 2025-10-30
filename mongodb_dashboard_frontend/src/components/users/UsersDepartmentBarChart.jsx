import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import PropTypes from 'prop-types';
import './usersCharts.css';

// PUBLIC_INTERFACE
export default function UsersDepartmentBarChart({ data, loading, height = 260 }) {
  /** Renders a bar chart of active users by department. */
  const theme = {
    primary: '#2563EB',
    grid: '#e5e7eb',
    text: '#111827',
  };

  const processed = Array.isArray(data)
    ? data.map((d) => ({
        label: d.label || 'Unknown',
        count: typeof d.count === 'number' ? d.count : 0,
      }))
    : [];

  return (
    <div className="users-chart-card">
      <div className="users-chart-title">Users by Department</div>
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <BarChart data={processed} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
            <XAxis dataKey="label" stroke={theme.text} fontSize={12} />
            <YAxis stroke={theme.text} fontSize={12} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" name="Active Users" fill={theme.primary} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {loading && <div className="users-chart-loading">Loading…</div>}
    </div>
  );
}

UsersDepartmentBarChart.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string,
      count: PropTypes.number,
    })
  ),
  loading: PropTypes.bool,
  height: PropTypes.number,
};
