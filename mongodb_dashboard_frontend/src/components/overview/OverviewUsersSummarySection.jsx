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
 * OverviewUsersSummarySection
 * Renders users created summary with time range filters and consumes /api/users/summary.
 */
export default function OverviewUsersSummarySection({ defaultRange = 'daily' }) {
  const orgId = useCurrentOrgId();
  const [range, setRange] = useState(defaultRange);
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);

  // Keep custom dates in sensible order
  useEffect(() => {
    if (range === 'custom' && startDate && endDate) {
      const s = parseISO(startDate);
      const e = parseISO(endDate);
      if (s > e) {
        // swap to keep valid range
        setStartDate(endDate);
        setEndDate(startDate);
      }
    }
  }, [range, startDate, endDate]);

  // Build params for hook
  const hookParams = useMemo(() => {
    const p = { range, organization_id: orgId || undefined };
    if (range === 'custom') {
      p.start_date = startDate;
      p.end_date = endDate;
    }
    return p;
  }, [range, startDate, endDate, orgId]);

  const { loading, data, error } = useUsersSummary(hookParams);

  // Map API buckets -> chart data
  const chartData = useMemo(() => {
    const buckets = Array.isArray(data?.buckets) ? data.buckets : [];
    return buckets.map((b) => ({
      key: String(b.key ?? b.label ?? ''),
      label: String(b.label ?? b.key ?? ''),
      count: Number(b.count ?? 0),
    }));
  }, [data]);

  return (
    <section className="overview-users-summary" aria-label="Users created summary">
      <div className="overview-users-summary__header">
        <h2 className="overview-users-summary__title">Users Created</h2>
        <div className="overview-users-summary__controls">
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
        height={260}
      />
    </section>
  );
}

OverviewUsersSummarySection.propTypes = {
  defaultRange: PropTypes.oneOf(['daily', 'weekly', 'monthly', 'custom']),
};
