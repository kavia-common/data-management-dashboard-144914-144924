import React, { useMemo } from 'react';
import Card from '../ui/Card.jsx';
import Skeleton from '../ui/Skeleton.jsx';
import T0000OrgHorizontalBarChart from './T0000OrgHorizontalBarChart';
import { useProjectsCreatedSummary } from '../../hooks/useProjectsCreatedSummary';
import { getOrgIdFromContext } from '../../utils/orgContext';

/**
 * PUBLIC_INTERFACE
 * SummaryPanel
 * Adds conditional T0000 chart rendering while preserving existing summary cards.
 */
// PUBLIC_INTERFACE
export default function SummaryPanel({ className = '' }) {
  // Hook is called unconditionally at top-level to avoid conditional-hooks rule issues
  const { data, t0000Series, loading, error, organization_id } = useProjectsCreatedSummary({ range: 'daily' });

  const effectiveOrg = useMemo(
    () => (organization_id || getOrgIdFromContext() || '').toString().toUpperCase(),
    [organization_id]
  );
  const isT0000 = effectiveOrg === 'T0000';

  const buckets = Array.isArray(data?.buckets) ? data.buckets : [];
  const safeSeries = useMemo(() => (Array.isArray(t0000Series) ? t0000Series : []), [t0000Series]);

  if (process.env.NODE_ENV !== 'test') {
    // eslint-disable-next-line no-console
    console.debug('[SummaryPanel] state', {
      org: effectiveOrg,
      loading,
      hasError: !!error,
      buckets: buckets.length,
      t0000SeriesLen: safeSeries.length,
    });
  }

  return (
    <div className={className}>
      <Card title="Summary" subtitle="Key insights from recent activity">
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
            <Skeleton height={72} />
            <Skeleton height={72} />
            <Skeleton height={72} />
          </div>
        ) : error ? (
          <div role="alert">Error loading summary</div>
        ) : (
          <div style={{ marginBottom: 12, color: 'var(--ocean-muted, #6B7280)' }}>{buckets.length} buckets</div>
        )}
      </Card>

      {/* Render T0000-only horizontal bar */}
      {isT0000 ? (
        <div style={{ marginTop: 16 }}>
          <T0000OrgHorizontalBarChart series={safeSeries} />
        </div>
      ) : null}
    </div>
  );
}
