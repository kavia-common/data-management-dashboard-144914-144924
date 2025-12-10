import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import UsersCreatedBarChart from '../charts/UsersCreatedBarChart';
import '../charts/ActiveUsersTrendChart.css';
import './overview.css';
import OverviewTimeControls from './OverviewTimeControls';
import { useAuth } from '../../context/AuthContext';
import { resolveOrganizationId } from '../../utils/orgContext';

/**
 * PUBLIC_INTERFACE
 * OverviewUsersSummary (placeholder)
 * This component no longer calls /api/users/summary.
 * It renders the same UI with empty data to keep the layout stable.
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

  // Static, empty dataset (no network)
  const data = [];
  const loading = false;
  const error = null;

  return (
    <section className="overview-section" aria-label="Users Created Summary (placeholder)">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
        <h3 className="chart-title" style={{ margin: 0 }}>
          Users Created
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
