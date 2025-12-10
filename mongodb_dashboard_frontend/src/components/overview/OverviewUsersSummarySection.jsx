import React, { useMemo, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import UsersSummaryBarChart from '../charts/UsersSummaryBarChart';
import './overview.css';
import './overviewUsersSummary.css';
import useCurrentOrgId from '../../hooks/useCurrentOrgId';
import { format, parseISO } from 'date-fns';

/**
 * PUBLIC_INTERFACE
 * OverviewUsersSummarySection (placeholder)
 * Previously used useUsersSummary to call /api/users/summary.
 * Now renders static/empty data to keep the UI stable without network calls.
 */
export default function OverviewUsersSummarySection({ defaultRange = 'daily' }) {
  const orgId = useCurrentOrgId();
  const [range, setRange] = useState(defaultRange);
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);

  // Prepare placeholder data shape consistent with UsersSummaryBarChart
  const chartData = useMemo(() => {
    // Could add fake buckets for demo; keep empty to avoid implying real data.
    return [];
  }, [range, startDate, endDate, orgId]);

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

  return (
    <section className="overview-users-summary" aria-label="Users created summary (placeholder)">
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
        loading={false}
        error={null}
        title=""
        height={260}
      />
    </section>
  );
}

OverviewUsersSummarySection.propTypes = {
  defaultRange: PropTypes.oneOf(['daily', 'weekly', 'monthly', 'custom']),
};
