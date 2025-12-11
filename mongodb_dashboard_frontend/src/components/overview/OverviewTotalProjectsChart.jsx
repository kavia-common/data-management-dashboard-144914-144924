import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { format } from 'date-fns';

/**
// PUBLIC_INTERFACE
 * OverviewTotalProjectsChart
 * Renders total projects trend over time as a bar chart.
 * - X axis shows full date labels (YYYY-MM-DD for stability).
 * - Tooltip shows full date and count and lists top users for that day when available.
 * Props:
 *  - data: array of per-day buckets: { date, bucket_start, count, by_user? }
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

  function toFullDateLabel(raw) {
    if (!raw) return '';
    try {
      if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) return String(raw);
      return format(d, 'yyyy-MM-dd');
    } catch {
      return String(raw);
    }
  }

  const chartData = useMemo(() => {
    if (!Array.isArray(data)) return [];

    const mapped = data.map((row) => {
      const bucket = row.bucket_start ?? row.date;
      const date = toFullDateLabel(bucket);
      const count = typeof row.count === 'number' ? row.count : (typeof row.total === 'number' ? row.total : 0);
      const users = Array.isArray(row.by_user) ? row.by_user : Array.isArray(row.users) ? row.users : [];

      return {
        date,
        count,
        _iso: bucket,
        _users: users,
      };
    });

    mapped.sort((a, b) => {
      const ta = new Date(`${a._iso}T00:00:00.000Z`).getTime();
      const tb = new Date(`${b._iso}T00:00:00.000Z`).getTime();
      if (!Number.isNaN(ta) && !Number.isNaN(tb)) return ta - tb;
      return String(a.date).localeCompare(String(b.date));
    });

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

  const axisTickFormatter = (value) => value;
  const tooltipLabelFormatter = (label) => `Date: ${label}`;
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const item = payload[0]?.payload;
      const topUsers = (item?._users || []).slice(0, 5);
      return (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{tooltipLabelFormatter(label)}</div>
          <div style={{ marginBottom: 6 }}>Projects: <strong>{item?.count ?? payload[0].value}</strong></div>
          {topUsers.length > 0 && (
            <div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>Top users</div>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                {topUsers.map((u) => (
                  <li key={String(u.user_name ?? 'unknown')}>
                    <span style={{ color: '#374151' }}>{u.user_name ?? 'unknown'}</span>
                    <span style={{ color: '#2563EB' }}> ({u.count})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="overview-card" aria-label="Total Projects over time" style={{ width: '100%' }}>
      <h3 className="overview-card-title">Total Projects</h3>
      <div className="overview-chart-wrapper" role="img" aria-describedby="total-projects-desc" style={{ width: '100%' }}>
        <p id="total-projects-desc" className="sr-only">
          Bar chart showing the number of projects created per day with full dates on the x-axis.
        </p>
        <ResponsiveContainer width="100%" height={height - 60}>
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 20, bottom: 20, left: 10 }}
            barCategoryGap="20%"
          >
            <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={axisTickFormatter}
              tick={{ fontSize: 12, fill: '#111827' }}
              interval="preserveStartEnd"
              minTickGap={24}
              height={32}
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
      bucket_start: PropTypes.string,
      date: PropTypes.string,
      count: PropTypes.number,
      by_user: PropTypes.array,
    })
  ),
  range: PropTypes.string,
  height: PropTypes.number,
  loading: PropTypes.bool,
  error: PropTypes.any,
};
