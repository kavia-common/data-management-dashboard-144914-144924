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
import ServiceTypesCreatedBarChart from './ServiceTypesCreatedBarChart';

/**
 * PUBLIC_INTERFACE
 * OverviewUsersSummarySection
 * For org_id === 'T0000', renders a horizontal per-tenant totals chart using existing /api/users/summary
 * data via useUsersSummary (orgTotals). For other orgs, preserve the current date-bucket bar chart.
 */
export default function OverviewUsersSummarySection({ defaultRange = 'daily' }) {
  const orgId = useCurrentOrgId();
  const [range, setRange] = useState(defaultRange);
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);

  // Ensure custom date range order is valid
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

  // Hook params: reuse existing filters and org scoping
  const hookParams = useMemo(() => {
    const p = { range, organization_id: orgId || undefined };
    if (range === 'custom') {
      p.start_date = startDate;
      p.end_date = endDate;
    }
    return p;
  }, [range, startDate, endDate, orgId]);

  const { loading, error, buckets, orgTotals } = useUsersSummary(hookParams);
  const isAllOrgs = useMemo(() => String(orgId || '').toUpperCase() === 'T0000', [orgId]);

  // Non-T0000: map time buckets for existing vertical UsersSummaryBarChart
  const chartData = useMemo(() => {
    const mapped = (Array.isArray(buckets) ? buckets : []).map(({ label, count }, i) => ({
      label: String(label ?? `Bucket ${i + 1}`),
      count: Number.isFinite(Number(count)) ? Number(count) : 0,
    }));
    return mapped;
  }, [buckets]);

  // T0000: build rows for horizontal totals by tenant (label uses tenant/org name if available)
  const totalsRows = useMemo(() => {
    if (!isAllOrgs) return [];
    const items = Array.isArray(orgTotals) ? orgTotals : [];
    return items.map((o, i) => {
      const tenantLabel =
        o?.label ||
        o?.tenant_name ||
        o?.organization_name ||
        o?.orgLabel ||
        o?.orgId ||
        `Tenant ${i + 1}`;
      const totalVal = Number.isFinite(Number(o?.total)) ? Number(o.total) : 0;
      return { label: String(tenantLabel), total: totalVal };
    });
  }, [isAllOrgs, orgTotals]);

  // Guarded debug for totals view
  if (typeof window !== 'undefined' && window?.DEBUG?.usersSummary && isAllOrgs) {
    // eslint-disable-next-line no-console
    console.debug('[OverviewUsersSummarySection] totalsRows sample', totalsRows.slice(0, 3));
  }

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

      {/* Chart body - fixed height container */}
      <div className="users-summary-chart__body" style={{ minHeight: 350, height: 350 }}>
        {isAllOrgs ? (
          // Required: horizontal bar chart grouped by tenant for T0000
          <UsersSummaryStackedBar
            rows={totalsRows}
            orgs={['total']}
            loading={loading}
            error={error}
            height={350}
          />
        ) : (
          // Preserve existing behavior for non-T0000 orgs
          <UsersSummaryBarChart
            data={chartData}
            loading={loading}
            error={error}
            title=""
            height={350}
          />
        )}
      </div>

      {/* Keep existing additional element below, if present */}
      <div className="project_summary_chart" style={{ marginTop: 24 }}>
        <ProjectsCreatedBarChart />
      </div>

      {/* ServiceTypesCreatedBarChart Keep existing additional element below, if present */}
      <div className="service_types_summary_chart" style={{ marginTop: 24 }}>
        <ServiceTypesCreatedBarChart />
      </div>

    </section>
  );
}

OverviewUsersSummarySection.propTypes = {
  defaultRange: PropTypes.oneOf(['daily', 'weekly', 'monthly', 'custom']),
};
