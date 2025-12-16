import React, { useMemo, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import UsersSummaryBarChart from '../charts/UsersSummaryBarChart';
import UsersSummaryStackedBar from './UsersSummaryStackedBar';
import './overview.css';
import './overviewUsersSummary.css';
import useCurrentOrgId from '../../hooks/useCurrentOrgId';
import useUsersSummary from '../../hooks/useUsersSummary';
import { format, parseISO } from 'date-fns';
import ProjectsCreatedBarChart from './ProjectsCreatedBarChart';

/**
 * PUBLIC_INTERFACE
 * OverviewUsersSummarySection
 * For org_id === 'T0000', renders a horizontal per-organization totals chart.
 * For other orgs, renders the existing date-bucket chart unchanged.
 */
export default function OverviewUsersSummarySection({ defaultRange = 'daily' }) {
  const orgId = useCurrentOrgId();
  const [range, setRange] = useState(defaultRange);
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);

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

  const hookParams = useMemo(() => {
    const p = { range, organization_id: orgId || undefined };
    if (range === 'custom') {
      p.start_date = startDate;
      p.end_date = endDate;
    }
    return p;
  }, [range, startDate, endDate, orgId]);

  const { loading, data, error, buckets, orgTotals } = useUsersSummary(hookParams);
  const isAllOrgs = useMemo(() => String(orgId || '').toUpperCase() === 'T0000', [orgId]);

  // Build standard date-bucket chart data
  const chartData = useMemo(() => {
    const mapped = (Array.isArray(buckets) ? buckets : []).map(({ label, count }, i) => ({
      label: String(label ?? `Bucket ${i + 1}`),
      count: Number.isFinite(Number(count)) ? Number(count) : 0,
    }));
    return mapped;
  }, [buckets]);

  // For totals view, convert orgTotals -> rows suitable for stacked component as single-series per org
  const totalsRows = useMemo(() => {
    if (!isAllOrgs) return [];
    const items = Array.isArray(orgTotals) ? orgTotals : [];
    // Shape for horizontal chart: each row => { label: orgLabel, total }
    const rows = items.map((o) => ({
      label: String(o?.orgLabel ?? o?.orgId ?? 'unknown'),
      total: Number.isFinite(Number(o?.total)) ? Number(o.total) : 0,
    }));
    return rows;
  }, [isAllOrgs, orgTotals]);

  // Guarded debug for totals
  if (typeof window !== 'undefined' && window?.DEBUG?.usersSummary && isAllOrgs) {
    // eslint-disable-next-line no-console
    console.debug('[OverviewUsersSummarySection] orgTotals', {
      len: orgTotals?.length || 0,
      sample: orgTotals?.[0],
    });
  }

  return (
    <section className="overview-users-summary" aria-label="Users created summary">
      <div className="overview-users-summary__header">
        <h2 className="overview-users-summary__title">Users Created</h2>
        <div className="overview-users-summary__controls">
          <div className="btn-group" role="group" aria-label="Time range">
            <button type="button" className={`btn ${range === 'daily' ? 'btn-active' : ''}`} onClick={() => setRange('daily')}>
              Daily
            </button>
            <button type="button" className={`btn ${range === 'weekly' ? 'btn-active' : ''}`} onClick={() => setRange('weekly')}>
              Weekly
            </button>
            <button type="button" className={`btn ${range === 'monthly' ? 'btn-active' : ''}`} onClick={() => setRange('monthly')}>
              Monthly
            </button>
            <button type="button" className={`btn ${range === 'custom' ? 'btn-active' : ''}`} onClick={() => setRange('custom')}>
              Custom
            </button>
          </div>
          {range === 'custom' && (
            <div className="date-range">
              <label className="date-field">
                <span>From</span>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} max={endDate} />
              </label>
              <label className="date-field">
                <span>To</span>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate} />
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Chart body - preserve sizing */}
      <div className="users-summary-chart__body" style={{ minHeight: 350, height: 350 }}>
        {isAllOrgs ? (
          // Horizontal totals chart
          <UsersSummaryStackedBar
            rows={totalsRows.map((r) => ({ label: r.label, total: r.total }))}
            orgs={['total']}
            loading={loading}
            error={error}
            height={350}
          />
        ) : (
          // Existing non-T0000 chart path unchanged
          <UsersSummaryBarChart data={chartData} loading={loading} error={error} title="" height={350} />
        )}
      </div>

      {/* New: Projects Created chart positioned below Users summary */}
      <div class="session_created_chart" style={{ marginTop: 24 }}>
        <ProjectsCreatedBarChart />
      </div>
    </section>
  );
}

OverviewUsersSummarySection.propTypes = {
  defaultRange: PropTypes.oneOf(['daily', 'weekly', 'monthly', 'custom']),
};
