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

  // Diagnostics: fetch start/end and params/response length get logged by the hook.
  // Log only lightweight derived info here.
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

  if (loading) {
    return <OverviewEmptyState message="Loading overview..." />;
  }
  if (error) {
    if (process.env.NODE_ENV !== 'test') {
      // eslint-disable-next-line no-console
      console.debug('[OverviewContainer] fetch error', { organization_id: effectiveOrg, error: String(error) });
    }
    return <OverviewEmptyState message="Failed to load overview." />;
  }

  const hasData = Array.isArray(data?.buckets) && data.buckets.length > 0;

  // Build series for T0000 chart; if hook already produced a series, prefer it.
  const t0000Series = useMemo(() => {
    if (!isT0000) return [];
    if (Array.isArray(hookSeries)) return hookSeries;
    return projectCreateT0000Series(data?.buckets || []);
  }, [isT0000, hookSeries, data]);

  return (
    <div className="overview-container">
      {/* Preserve all original panels/sections in the same order */}
      <OverviewTimeControls />
      <OverviewKpiCards />
      <OverviewUsersSummarySection />

      {/* Keep existing projects created chart unchanged for all orgs */}
      {hasData && (
        <div style={{ marginTop: 16 }}>
          <ProjectsCreatedBarChart data={data} />
        </div>
      )}

      {/* Append-only: T0000 horizontal bar chart panel; keep skeleton mounted even if empty */}
      {isT0000 && (
        <div style={{ marginTop: 24 }}>
          {Array.isArray(t0000Series) && t0000Series.length > 0 ? (
            <T0000OrgHorizontalBarChart series={t0000Series} title="Projects Created (T0000)" />
          ) : (
            // Keep placeholder but mount the chart shell to force layout reservation and visibility
            <div>
              <T0000OrgHorizontalBarChart series={[]} title="Projects Created (T0000)" />
              <OverviewEmptyState message="No data yet" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
