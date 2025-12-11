import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { format } from 'date-fns';

/**
// PUBLIC_INTERFACE
 * OverviewTotalProjectsChart
 * Renders total projects trend over time as a bar chart.
 * - X axis shows full date labels (YYYY-MM-DD for stability).
 * - Tooltip shows full date and count.
 * - Data bucket alignment matches the provided range (daily/weekly/monthly/custom).
 * Props:
 *  - data: array of bucketed items. Supports keys: bucket_start, bucket, date, key, created_at, timestamp, time
 *  - range: string ('daily' | 'weekly' | 'monthly' | 'custom')
 *  - height: number (chart height, default 280)
 *  - loading: bool
 *  - error: any
 */
export default function OverviewTotalProjectsChart({ data = [], range = 'daily', height = 280, loading, error }) {
  // accessibility-friendly container styling is handled by parent modules/pages with CSS classes.
  // Keep minimal inline styling here for resilience.
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

  // Format raw date-like value to a stable YYYY-MM-DD label
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

  // Map incoming API data to chart rows with stable sorting
  const chartData = useMemo(() => {
    if (!Array.isArray(data)) return [];

    const mapped = data.map((row) => {
      const bucket =
        row.bucket_start ??
        row.bucket ??
        row.date ??
        row.key ??
        row.created_at ??
        row.timestamp ??
        row.time;

      const date = toFullDateLabel(bucket);
      const count = typeof row.count === 'number' ? row.count : (typeof row.total === 'number' ? row.total : 0);

      return {
        date,       // label on x-axis (YYYY-MM-DD)
        count,      // bar value
        _iso: bucket, // used for sorting when parseable
      };
    });

    mapped.sort((a, b) => {
      const ta = new Date(a._iso || a.date).getTime();
      const tb = new Date(b._iso || b.date).getTime();
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

  const axisTickFormatter = (value) => value; // already full date YYYY-MM-DD
  const tooltipFormatter = (value) => [`${value}`, 'Projects'];
  const tooltipLabelFormatter = (label) => `Date: ${label}`;

  return (
    <div className="overview-card" aria-label="Total Projects over time" style={{ width: '100%' }}>
      <h3 className="overview-card-title">Total Projects</h3>
      <div className="overview-chart-wrapper" role="img" aria-describedby="total-projects-desc" style={{ width: '100%' }}>
        <p id="total-projects-desc" className="sr-only">
          Bar chart showing the number of projects created per selected time bucket with full dates on the x-axis.
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
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 12, fill: '#111827' }}
            />
            <Tooltip
              formatter={tooltipFormatter}
              labelFormatter={tooltipLabelFormatter}
              cursor={{ fill: 'rgba(0,0,0,0.04)' }}
              wrapperStyle={{ zIndex: 1000 }}
            />
            <Bar
              name="Projects"
              dataKey="count"
              fill="#2563EB"
              radius={[4, 4, 0, 0]}
              isAnimationActive={true}
            />
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
      bucket: PropTypes.string,
      date: PropTypes.string,
      key: PropTypes.string,
      created_at: PropTypes.string,
      timestamp: PropTypes.string,
      time: PropTypes.string,
      count: PropTypes.number,
      total: PropTypes.number,
    })
  ),
  range: PropTypes.string,
  height: PropTypes.number,
  loading: PropTypes.bool,
  error: PropTypes.any,
};
