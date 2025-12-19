'use strict';

/**
 * PUBLIC_INTERFACE
 * adaptProjectCreateBuckets
 * Given API response buckets and the organization_id used in the request,
 * normalize buckets for display:
 * - For T0000: use label/key (organization_id) as display and keep user fields null.
 * - Otherwise: prefer user_name as label.
 */
// PUBLIC_INTERFACE
export function adaptProjectCreateBuckets(buckets = [], organization_id) {
  /** This is a public function. */
  const isT0000 = String(organization_id || '').toUpperCase() === 'T0000';
  if (!Array.isArray(buckets)) return [];
  if (isT0000) {
    return buckets.map((b) => ({
      ...b,
      display: b.label || b.key || 'unknown',
    }));
  }
  return buckets.map((b) => ({
    ...b,
    display: b.user_name || b.label || b.key || b.user_id || '',
  }));
}
