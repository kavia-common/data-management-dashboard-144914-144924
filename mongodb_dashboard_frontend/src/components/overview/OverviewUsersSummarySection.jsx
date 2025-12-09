import React, { useMemo, useState } from 'react';
import UsersSummaryBarChart from '../charts/UsersSummaryBarChart';
import { formatDateUTC } from '../../utils/date';
import useCurrentOrgId from '../../hooks/useCurrentOrgId';
import { useUsersSummary } from '../../hooks/useUsersSummary';
import './overviewUsersSummary.css';

/**
 * PUBLIC_INTERFACE
 * OverviewUsersSummarySection
 * Section component for Overview page that renders range controls and the Users Summary bar chart.
 */
export default function OverviewUsersSummarySection() {
  const orgId = useCurrentOrgId();

  const today = useMemo(() => formatDateUTC(new Date()), []);
  const [range, setRange] = useState('daily');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  const { data, loading, error } = useUsersSummary(range, range === 'custom' ? startDate : null, range === 'custom' ? endDate : null, orgId);

  const buckets = (data?.buckets || []).map(b => ({
    key: b.key,
    label: b.label,
    count: b.count,
    start: data?.start_date || null,
    end: data?.end_date || null,
  }));

  return (
    <section className="overview-users-summary">
      <div className="ous-header">
        <h2>Users Created Summary</h2>
        <div className="ous-controls">
          <div className="ous-range">
            <label>
              <input
                type="radio"
                name="users-range"
                value="daily"
                checked={range === 'daily'}
                onChange={() => setRange('daily')}
              />
              Daily
            </label>
            <label>
              <input
                type="radio"
                name="users-range"
                value="weekly"
                checked={range === 'weekly'}
                onChange={() => setRange('weekly')}
              />
              Weekly
            </label>
            <label>
              <input
                type="radio"
                name="users-range"
                value="monthly"
                checked={range === 'monthly'}
                onChange={() => setRange('monthly')}
              />
              Monthly
            </label>
            <label>
              <input
                type="radio"
                name="users-range"
                value="custom"
                checked={range === 'custom'}
                onChange={() => setRange('custom')}
              />
              Custom
            </label>
          </div>

          {range === 'custom' && (
            <div className="ous-dates">
              <label className="ous-date">
                <span>Start</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
              </label>
              <label className="ous-date">
                <span>End</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                />
              </label>
            </div>
          )}
        </div>
      </div>

      <UsersSummaryBarChart
        title="Users Created"
        buckets={buckets}
        loading={loading}
        error={error}
        emptyMessage="No users found for the selected period."
      />
    </section>
  );
}
