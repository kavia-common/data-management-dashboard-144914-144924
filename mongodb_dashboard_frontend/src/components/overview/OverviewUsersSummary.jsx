import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { fetchUsersSummary } from '../../api/usersSummary';
import UsersCreatedBarChart from '../charts/UsersCreatedBarChart';
import '../charts/ActiveUsersTrendChart.css';
import './overview.css';

/**
 * PUBLIC_INTERFACE
 * OverviewUsersSummary
 * Fetches and displays the Users Created bar chart with a themed header and range controls.
 */
export default function OverviewUsersSummary({ organizationId: organizationIdProp }) {
  const orgId = organizationIdProp || 'b2c';

  const [range, setRange] = useState('daily');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const query = useMemo(() => {
    if (range === 'custom') {
      return { organization_id: orgId, range, start_date: startDate, end_date: endDate };
    }
    return { organization_id: orgId, range };
  }, [orgId, range, startDate, endDate]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchUsersSummary(query);
        const items = (res?.buckets || []).map(b => ({ label: b.label ?? b.key, count: b.count ?? 0 }));
        if (!cancelled) {
          setData(items);
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load users summary');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (orgId) load();
    return () => { cancelled = true; };
  }, [orgId, query.organization_id, query.range, query.start_date, query.end_date]);

  const isCustom = range === 'custom';

  return (
    <section className="overview-section">
      <h3 className="chart-title">Users Created</h3>

      <div className="range-selector" style={{ marginBottom: 8 }}>
        {['daily', 'weekly', 'monthly', 'custom'].map(key => (
          <button
            key={key}
            type="button"
            className={`range-chip ${range === key ? 'range-chip--active' : ''}`}
            onClick={() => setRange(key)}
            aria-pressed={range === key}
          >
            {key.charAt(0).toUpperCase() + key.slice(1)}
          </button>
        ))}
        {isCustom && (
          <div className="date-picker" role="group" aria-label="Custom date range">
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span style={{ color: 'rgba(17,24,39,0.55)', fontSize: 12 }}>to</span>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        )}
      </div>

      <UsersCreatedBarChart
        data={data}
        loading={loading}
        error={error}
      />
    </section>
  );
}

OverviewUsersSummary.propTypes = {
  organizationId: PropTypes.string,
};
