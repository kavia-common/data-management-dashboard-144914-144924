'use strict';

/**
 * PUBLIC_INTERFACE
 * shapeT0000ProjectCreateSeries
 * Converts api/project-create/summary buckets into [{ name, value }] for T0000 view.
 * It reuses adaptProjectCreateBuckets to pick display names consistently.
 */
import { adaptProjectCreateBuckets } from './projectCreateSummaryAdapter';

// PUBLIC_INTERFACE
export function shapeT0000ProjectCreateSeries(apiBuckets = [], organization_id = 'T0000') {
  /** This is a public function. */
  const adapted = adaptProjectCreateBuckets(apiBuckets, organization_id);
  // For T0000, adapted[].display holds the organization label per existing adapter.
  return adapted.map((b) => ({
    name: String(b.display || b.label || b.key || 'unknown'),
    value: Number.isFinite(Number(b.count)) ? Number(b.count) : Number(b.value ?? 0),
  }));
}
