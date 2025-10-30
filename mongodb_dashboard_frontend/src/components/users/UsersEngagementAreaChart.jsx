import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import PropTypes from 'prop-types';
import { formatLabel } from '../../utils/formatLabel';
import './usersCharts.css';

// PUBLIC_INTERFACE
export default function UsersEngagementAreaChart({ data, loading, height = 280 }) {
  /** Renders an area chart with Active Users and Sessions time series. */
  const theme = {
    primary: '#2563EB', // blue
    secondary: '#F59E0B', // amber
    grid: '#e5e7eb',
    text: '#111827',
  };

  const processed = Array.isArray(data)
    ? data.map((d) => ({
        date: d.date,
        users: typeof d.total === 'number' ? d.total : 0,
        sessions: typeof d.sessions === 'number' ? d.sessions : 0,
      }))
    : [];

  return (
    <div className="users-chart-card">
      <div className="users-chart-title">Engagement Trend</div>
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <AreaChart data={processed}>
            <defs>
              <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={theme.primary} stopOpacity={0.35}/>
                <stop offset="95%" stopColor={theme.primary} stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorSessions" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={theme.secondary} stopOpacity={0.35}/>
                <stop offset="95%" stopColor={theme.secondary} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
            <XAxis
              dataKey="date"
              tickFormatter={formatLabel}
              stroke={theme.text}
              fontSize={12}
            />
            <YAxis stroke={theme.text} fontSize={12} allowDecimals={false} />
            <Tooltip
              formatter={(value, name) => [value, name]}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="users"
              name="Active Users"
              stroke={theme.primary}
              fillOpacity={1}
              fill="url(#colorUsers)"
            />
            <Area
              type="monotone"
              dataKey="sessions"
              name="Sessions"
              stroke={theme.secondary}
              fillOpacity={1}
              fill="url(#colorSessions)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {loading && <div className="users-chart-loading">Loading…</div>}
    </div>
  );
}

UsersEngagementAreaChart.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      date: PropTypes.string,
      total: PropTypes.number,
      sessions: PropTypes.number,
    })
  ),
  loading: PropTypes.bool,
  height: PropTypes.number,
};
