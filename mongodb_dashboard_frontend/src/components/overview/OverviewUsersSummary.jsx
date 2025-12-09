import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { fetchUsersSummary } from '../../api/usersSummary';
import UsersCreatedBarChart from '../charts/UsersCreatedBarChart';
import '../charts/ActiveUsersTrendChart.css';
import './overview.css';
import OverviewTimeControls from './OverviewTimeControls';
import { useAuth } from '../../context/AuthContext';
import { resolveOrganizationId } from '../../utils/orgContext';

/**
 * PUBLIC_INTERFACE
 * OverviewUsersSummary
 * Fetches and displays the Users Created bar chart with a themed header and range controls.
 * Adds a dynamic total next to the title based on current buckets.
 */
export default function OverviewUsersSummary({ organizationId: organizationIdProp }) {
  const auth = useAuth();
  const orgId = useMemo(
    () => organizationIdProp ?? resolveOrganizationId({ auth }),
    [organizationIdProp, auth]
  );

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
    load();
    return () => { cancelled = true; };
  }, [query.organization_id, query.range, query.start_date, query.end_date]);

  // Compute dynamic total from current data buckets
  const totalUsers = useMemo(
    () => data.reduce((sum, d) => sum + (Number(d.count) || 0), 0),
    [data]
  );

  return (
    <section className="overview-section">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
        <h3 className="chart-title" style={{ margin: 0 }}>
          Users Created
          <span
            style={{
              marginLeft: 8,
              fontWeight: 600,
              color: 'var(--ocean-primary)',
              fontSize: 13
            }}
            aria-label={`Total users in range: ${totalUsers}`}
            title={`Total users in range: ${totalUsers}`}
          >
            {Number(totalUsers).toLocaleString()}
          </span>
        </h3>

        <OverviewTimeControls
          range={range}
          onChangeRange={setRange}
          customRange={{ start: startDate, end: endDate }}
          onChangeCustom={(next) => {
            if (typeof next?.start === 'string') setStartDate(next.start);
            if (typeof next?.end === 'string') setEndDate(next.end);
          }}
        />
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
