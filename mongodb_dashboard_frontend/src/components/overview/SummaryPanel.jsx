import React from 'react';
import Card from '../ui/Card.jsx';
import Skeleton from '../ui/Skeleton.jsx';
import T0000OrgHorizontalBarChart from './T0000OrgHorizontalBarChart';
import useProjectsCreatedSummary from '../../hooks/useProjectsCreatedSummary';

/**
 * PUBLIC_INTERFACE
 * SummaryPanel
 * Adds conditional T0000 chart rendering while preserving existing summary cards.
 */
// PUBLIC_INTERFACE
export default function SummaryPanel({ className = '' }) {
  const { data, t0000Series, loading, error, organization_id } = useProjectsCreatedSummary({ range: 'daily' });

  if (process.env.NODE_ENV !== 'test') {
    // eslint-disable-next-line no-console
    console.debug('[SummaryPanel] state', {
      org: organization_id,
      loading,
      hasError: !!error,
      buckets: Array.isArray(data?.buckets) ? data.buckets.length : 0,
      t0000SeriesLen: Array.isArray(t0000Series) ? t0000Series.length : 0,
    });
  }

  if (loading) {
    return (
      <Card title="Summary" subtitle="Key insights from recent activity" className={className}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          <Skeleton height={72} />
          <Skeleton height={72} />
          <Skeleton height={72} />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card title="Summary" subtitle="Key insights from recent activity" className={className}>
        <div role="alert">Error loading summary</div>
      </Card>
    );
  }

  const buckets = Array.isArray(data?.buckets) ? data.buckets : [];
  const isT0000 = organization_id === 'T0000';

  return (
    <div className={className}>
      <Card title="Summary" subtitle="Key insights from recent activity">
        <div style={{ marginBottom: 12, color: 'var(--ocean-muted, #6B7280)' }}>{buckets.length} buckets</div>
      </Card>

      {/* Render T0000-only horizontal bar; keep skeleton mounted with placeholder when empty */}
      {isT0000 && (
        <div style={{ marginTop: 16 }}>
          <T0000OrgHorizontalBarChart series={Array.isArray(t0000Series) ? t0000Series : []} />
        </div>
      )}
    </div>
  );
}
