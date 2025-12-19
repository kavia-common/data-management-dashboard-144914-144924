/**
 * PUBLIC_INTERFACE
 * adaptProjectCreateSummary
 * - Non-T0000: expects { buckets: [{ key,label,count }, ...] } -> [{ name: label, value: count }]
 * - T0000: backend returns array [{ organization_id, count }] -> [{ name: organization_id, value: count }]
 */
// PUBLIC_INTERFACE
export function adaptProjectCreateSummary(data) {
  if (!data) return [];
  if (Array.isArray(data)) {
    // T0000 array response
    return data.map((d, idx) => ({
      name: d?.organization_id || d?.label || d?.key || `#${idx + 1}`,
      value: typeof d?.count === 'number' ? d.count : 0,
    }));
  }
  const buckets = Array.isArray(data?.buckets) ? data.buckets : [];
  return buckets.map((b) => ({
    name: b?.label || b?.key || '',
    value: typeof b?.count === 'number' ? b.count : 0,
  }));
}
