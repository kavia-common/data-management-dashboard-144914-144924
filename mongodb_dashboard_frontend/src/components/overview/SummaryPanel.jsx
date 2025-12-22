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
        {/* Keep minimal content; the detailed insight cards were part of earlier version. */}
      </Card>

      {/* Render T0000-only horizontal bar when applicable and data present */}
      {isT0000 && Array.isArray(t0000Series) && t0000Series.length > 0 ? (
        <div style={{ marginTop: 16 }}>
          <T0000OrgHorizontalBarChart series={t0000Series} />
        </div>
      ) : null}
    </div>
  );
}
