import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import './UsersSummaryBarChart.css';

// PUBLIC_INTERFACE
export default function UsersSummaryBarChart({ data, loading, error, title = 'Users Created', height = 240 }) {
  /** Renders a simple, responsive bar chart for users summary buckets. */
  const max = useMemo(() => {
    if (!data || data.length === 0) return 0;
    return Math.max(...data.map(d => d.count || 0));
  }, [data]);

  if (error) {
    return (
      <div className="users-summary-chart users-summary-chart--error">
        <div className="users-summary-chart__header">
          <h3 className="users-summary-chart__title">{title}</h3>
        </div>
        <div className="users-summary-chart__body">Error loading data</div>
      </div>
    );
  }

  return (
    <div className="users-summary-chart" style={{ minHeight: height }}>
      <div className="users-summary-chart__header">
        <h3 className="users-summary-chart__title">{title}</h3>
      </div>
      <div className="users-summary-chart__body">
        {loading ? (
          <div className="users-summary-chart__loading">Loading…</div>
        ) : (data && data.length) ? (
          <div className="users-summary-chart__bars" role="img" aria-label="Users created bar chart">
            {data.map((d) => {
              const pct = max > 0 ? (d.count / max) * 100 : 0;
              return (
                <div key={d.key} className="users-summary-chart__bar">
                  <div className="users-summary-chart__bar-inner" style={{ height: `${pct}%` }} title={`${d.label || d.key}: ${d.count}`} />
                  <div className="users-summary-chart__bar-label" title={d.label || d.key}>
                    {d.label || d.key}
                  </div>
                  <div className="users-summary-chart__bar-value">{d.count}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="users-summary-chart__empty">No data</div>
        )}
      </div>
    </div>
  );
}

UsersSummaryBarChart.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string,
      count: PropTypes.number.isRequired,
    })
  ),
  loading: PropTypes.bool,
  error: PropTypes.any,
  title: PropTypes.string,
  height: PropTypes.number,
};
