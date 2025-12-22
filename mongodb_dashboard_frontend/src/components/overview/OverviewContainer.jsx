import React, { useMemo } from 'react';
import OverviewTimeControls from './OverviewTimeControls';
import OverviewKpiCards from './OverviewKpiCards';
import OverviewUsersSummarySection from './OverviewUsersSummarySection';
import ProjectsCreatedBarChart from './ProjectsCreatedBarChart';
import T0000OrgHorizontalBarChart from './T0000OrgHorizontalBarChart';
import OverviewEmptyState from './OverviewEmptyState';
import { useProjectsCreatedSummary } from '../../hooks/useProjectsCreatedSummary';
import { projectCreateT0000Series } from '../../utils/projectCreateT0000Series';
import { getOrgIdFromContext } from '../../utils/orgContext';
import './overview.css';

/**
 * PUBLIC_INTERFACE
 * OverviewContainer
 * Preserves all existing overview sections and charts.
 * Appends a T0000-specific horizontal bar chart panel when organization_id === 'T0000'.
 * Adds minimal diagnostics for fetch lifecycle.
 * Keeps existing charts intact for non-T0000 flows.
 */
export default function OverviewContainer() {
  // Use the existing hook to fetch overview projects summary.
  const { data, loading, error, organization_id, t0000Series: hookSeries } = useProjectsCreatedSummary();

  const effectiveOrg = useMemo(() => organization_id || getOrgIdFromContext() || '', [organization_id]);
  const isT0000 = String(effectiveOrg).toUpperCase() === 'T0000';

  // Build series for T0000 chart; if hook already produced a series, prefer it.
  const t0000Series = useMemo(() => {
    if (!isT0000) return [];
    if (Array.isArray(hookSeries)) return hookSeries;
    return projectCreateT0000Series(data?.buckets || []);
  }, [isT0000, hookSeries, data]);

  // Precompute flags and UI nodes without early returns to keep hook order consistent
  const loadingNode = <OverviewEmptyState message="Loading overview..." />;
  const errorNode = (
    <>
      {process.env.NODE_ENV !== 'test' && console && console.debug
        ? // eslint-disable-next-line no-console
          console.debug('[OverviewContainer] fetch error', { organization_id: effectiveOrg, error: String(error) })
        : null}
      <OverviewEmptyState message="Failed to load overview." />
    </>
  );

  // minimal mount debug
  React.useEffect(() => {
    if (process.env.NODE_ENV !== 'test') {
      // eslint-disable-next-line no-console
      console.debug('[OverviewContainer] mount', { org: effectiveOrg || null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Diagnostics state log (non-blocking)
  if (process.env.NODE_ENV !== 'test') {
    // eslint-disable-next-line no-console
    console.debug('[OverviewContainer] state', {
      org: effectiveOrg,
      loading,
      hasError: !!error,
      buckets: Array.isArray(data?.buckets) ? data.buckets.length : 0,
      t0000SeriesLen: Array.isArray(hookSeries) ? hookSeries.length : 0,
    });
  }

  return (
    <div className="overview-container">
      {/* Top controls and KPIs always render to ensure independent hooks mount */}
      <OverviewTimeControls />
      <OverviewKpiCards />
      <OverviewUsersSummarySection />

      {/* Inline loading/error gates for primary data area without affecting hook order */}
      {loading ? (
        loadingNode
      ) : error ? (
        errorNode
      ) : (
        <>
          {/* Projects created chart should always mount independently */}
          <div style={{ marginTop: 16 }}>
            <ProjectsCreatedBarChart />
          </div>

          {/* Append-only: T0000 horizontal bar chart panel; keep skeleton mounted even if empty */}
          {isT0000 && (
            <div style={{ marginTop: 24 }}>
              {Array.isArray(t0000Series) && t0000Series.length > 0 ? (
                <T0000OrgHorizontalBarChart series={t0000Series} title="Projects Created (T0000)" />
              ) : (
                // Keep placeholder rendering and mount the chart shell for layout stability
                <div>
                  <T0000OrgHorizontalBarChart series={[]} title="Projects Created (T0000)" />
                  <OverviewEmptyState message="No data yet" />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
