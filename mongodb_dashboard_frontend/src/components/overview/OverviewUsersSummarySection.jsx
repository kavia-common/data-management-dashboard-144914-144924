import React, { useMemo, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import UsersSummaryBarChart from '../charts/UsersSummaryBarChart';
import UsersSummaryStackedBar from './UsersSummaryStackedBar';
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

  // Map API buckets -> chart data (strictly { label, count })
  const chartData = useMemo(() => {
    const buckets = Array.isArray(data?.buckets) ? data.buckets : [];
    const mapped = buckets.map(({ label, count }, i) => ({
      label: String(label ?? `Bucket ${i + 1}`),
      count: Number.isFinite(Number(count)) ? Number(count) : 0,
    }));
    return mapped;
  }, [data]);

  // For T0000, build stacked series using orgBuckets (if provided)
  const stackedConfig = useMemo(() => {
    const isAll = !!data?.isAllOrgs;
    const orgBuckets = Array.isArray(data?.orgBuckets) ? data.orgBuckets : [];
    if (!isAll || orgBuckets.length === 0) return null;

    // Build unified x-axis labels from top-level buckets to preserve date bars
    const labels = (Array.isArray(data?.buckets) ? data.buckets : []).map(b => String(b.label));
    // Determine the per-organization keys (use up to top 6 for readability)
    const orgs = orgBuckets.map(o => String(o.organization_id || 'unknown')).slice(0, 6);

    // Compose dataset for Recharts stacked bars: [{ label, [org1]: n, [org2]: n, ... }]
    const rows = labels.map(lbl => {
      const row = { label: lbl };
      for (const org of orgs) {
        const ob = orgBuckets.find(x => String(x.organization_id || 'unknown') === org);
        const day = ob?.buckets?.find(d => String(d.label) === lbl);
        row[org] = Number.isFinite(Number(day?.count)) ? Number(day.count) : 0;
      }
      return row;
    });

    return { labels, orgs, rows };
  }, [data]);

  // Instrumentation: log the exact props we will pass to UsersSummaryBarChart.
  // Gate logs in production to reduce noise.
  const isProd = (process.env.REACT_APP_NODE_ENV || process.env.NODE_ENV) === 'production';
  if (!isProd) {
    // eslint-disable-next-line no-console
    console.debug('[UsersSummary][Section] props to BarChart', {
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
      {/* Special rendering for T0000 (all orgs): stacked per-organization bars while preserving date buckets */}
      {data?.isAllOrgs && stackedConfig ? (
        <div className="users-summary-chart" style={{ minHeight: 280, height: 280 }}>
          <div className="users-summary-chart__header" />
          <div className="users-summary-chart__body" style={{ width: '100%', height: '100%' }}>
            <UsersSummaryStackedBar
              rows={stackedConfig.rows}
              orgs={stackedConfig.orgs}
              loading={loading}
              error={error}
              height={280}
            />
          </div>
        </div>
      ) : (
        <UsersSummaryBarChart
          data={chartData}
          loading={loading}
          error={error}
          title=""
          height={280}
        />
      )}
    </section>
  );
}

OverviewUsersSummarySection.propTypes = {
  defaultRange: PropTypes.oneOf(['daily', 'weekly', 'monthly', 'custom']),
};
