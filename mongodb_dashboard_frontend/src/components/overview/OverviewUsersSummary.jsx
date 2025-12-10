import React, { useMemo, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import UsersSummaryBarChart from '../charts/UsersSummaryBarChart';
import './overview.css';
import './overviewUsersSummary.css';
import useCurrentOrgId from '../../hooks/useCurrentOrgId';
import useUsersSummary from '../../hooks/useUsersSummary';
import { format, parseISO } from 'date-fns';

/**
 * PUBLIC_INTERFACE
 * OverviewUsersSummary
 * Renders users created summary with time range filters and consumes /api/users/summary.
 * Mirrors OverviewUsersSummarySection behavior so charts are consistent.
 */
export default function OverviewUsersSummary({ defaultRange = 'daily' }) {
  const orgId = useCurrentOrgId();
  const [range, setRange] = useState(defaultRange);
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);

  // Ensure valid custom range order
  useEffect(() => {
    if (range === 'custom' && startDate && endDate) {
      const s = parseISO(startDate);
      const e = parseISO(endDate);
      if (s > e) {
        setStartDate(endDate);
        setEndDate(startDate);
      }
    }
  }, [range, startDate, endDate]);

  // Hook params, pass organization_id and custom dates as needed
  const hookParams = useMemo(() => {
    const p = { range, organization_id: orgId || undefined };
    if (range === 'custom') {
      p.start_date = startDate;
      p.end_date = endDate;
    }
    return p;
  }, [range, startDate, endDate, orgId]);

  const { loading, data, error } = useUsersSummary(hookParams);

  // Normalize to chart data shape { key, label, count }
  const chartData = useMemo(() => {
    const buckets = Array.isArray(data?.buckets) ? data.buckets : [];
    const flat = buckets.map(({ label, count }, i) => ({
      label: String(label ?? `Bucket ${i + 1}`),
      count: Number.isFinite(Number(count)) ? Number(count) : 0,
    }));
    return flat;
  }, [data]);

  // Instrumentation similar to Section version, gated to avoid noise in production
  const isProd = (process.env.REACT_APP_NODE_ENV || process.env.NODE_ENV) === 'production';
  if (!isProd) {
    // eslint-disable-next-line no-console
    console.debug('[UsersSummary][Overview] props to BarChart', {
      dataLength: chartData?.length ?? 0,
      sample: Array.isArray(chartData) ? chartData.slice(0, 3) : [],
      options: {
        title: '',
        height: 280,
        loading,
        hasError: Boolean(error),
        params: hookParams,
      },
    });
  }

  return (
    <section className="overview-users-summary" aria-label="Users created summary">
      <div className="overview-users-summary__header">
        <h2 className="overview-users-summary__title">Users Created</h2>
        <div className="overview-users-summary__controls">
          {/* Lightweight DOM echo for quick verification */}
          {!isProd && (
            <details style={{ marginLeft: 8 }}>
              <summary>Chart debug</summary>
              <pre style={{ margin: 0, maxWidth: 520, whiteSpace: 'pre-wrap' }}>
{JSON.stringify({
  dataLength: chartData?.length ?? 0,
  sample: Array.isArray(chartData) ? chartData.slice(0, 3) : [],
  options: { title: '', height: 280, loading, hasError: Boolean(error) },
}, null, 2)}
              </pre>
            </details>
          )}
          <div className="btn-group" role="group" aria-label="Time range">
            <button
              type="button"
              className={`btn ${range === 'daily' ? 'btn-active' : ''}`}
              onClick={() => setRange('daily')}
            >
              Daily
            </button>
            <button
              type="button"
              className={`btn ${range === 'weekly' ? 'btn-active' : ''}`}
              onClick={() => setRange('weekly')}
            >
              Weekly
            </button>
            <button
              type="button"
              className={`btn ${range === 'monthly' ? 'btn-active' : ''}`}
              onClick={() => setRange('monthly')}
            >
              Monthly
            </button>
            <button
              type="button"
              className={`btn ${range === 'custom' ? 'btn-active' : ''}`}
              onClick={() => setRange('custom')}
            >
              Custom
            </button>
          </div>
          {range === 'custom' && (
            <div className="date-range">
              <label className="date-field">
                <span>From</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  max={endDate}
                />
              </label>
              <label className="date-field">
                <span>To</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                />
              </label>
            </div>
          )}
        </div>
      </div>
      <UsersSummaryBarChart
        data={chartData}
        loading={loading}
        error={error}
        title=""
        height={280}
      />
    </section>
  );
}

OverviewUsersSummary.propTypes = {
  defaultRange: PropTypes.oneOf(['daily', 'weekly', 'monthly', 'custom']),
};
