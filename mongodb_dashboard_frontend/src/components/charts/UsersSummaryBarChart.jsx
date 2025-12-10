import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import './UsersSummaryBarChart.css';

// PUBLIC_INTERFACE
export default function UsersSummaryBarChart({ data, loading, error, title = 'Users Created', height = 240 }) {
  /**
   * Renders a simple, responsive bar chart for users summary buckets.
   * Accepts data = [{ key, label, count }]
   * Guards against empty/invalid inputs and renders accessible states.
   */
  const safeData = Array.isArray(data) ? data.filter(Boolean) : [];
  const max = useMemo(() => {
    if (!safeData.length) return 0;
    const values = safeData.map(d => {
      const n = Number(d?.count);
      return Number.isFinite(n) ? n : 0;
    });
    return values.length ? Math.max(...values) : 0;
  }, [safeData]);

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[UsersSummaryBarChart] rendering with error', error);
    const errMsg = (error && (error.message || error.status || 'Error')) || 'Error';
    return (
      <div className="users-summary-chart users-summary-chart--error" role="alert" aria-live="polite">
        <div className="users-summary-chart__header">
          {title ? <h3 className="users-summary-chart__title">{title}</h3> : null}
        </div>
        <div className="users-summary-chart__body" title={String(errMsg)}>Error loading data</div>
      </div>
    );
  }

  return (
    <div className="users-summary-chart" style={{ minHeight: height }}>
      <div className="users-summary-chart__header">
        {title ? <h3 className="users-summary-chart__title">{title}</h3> : null}
      </div>
      <div className="users-summary-chart__body">
        {loading ? (
          <div className="users-summary-chart__loading">Loading…</div>
        ) : safeData.length ? (
          <div className="users-summary-chart__bars" role="img" aria-label="Users created bar chart">
            {safeData.map((d, idx) => {
              const val = Number.isFinite(Number(d?.count)) ? Number(d.count) : 0;
              const key = (d && (d.key || d.label)) || `bar-${idx}`;
              const lbl = (d && (d.label || d.key)) || `Bucket ${idx + 1}`;
              const pct = max > 0 ? (val / max) * 100 : 0;
              return (
                <div key={key} className="users-summary-chart__bar">
                  <div
                    className="users-summary-chart__bar-inner"
                    style={{ height: `${pct}%` }}
                    title={`${lbl}: ${val}`}
                    aria-label={`${lbl}: ${val}`}
                    role="img"
                  />
                  <div className="users-summary-chart__bar-label" title={lbl}>
                    {lbl}
                  </div>
                  <div className="users-summary-chart__bar-value" aria-hidden="true">{val}</div>
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
