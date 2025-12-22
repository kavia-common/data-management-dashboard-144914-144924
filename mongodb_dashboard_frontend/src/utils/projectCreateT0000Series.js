import getOceanColors from '../theme/colors';

/**
 * PUBLIC_INTERFACE
 * projectCreateT0000Series
 * Adapt API buckets into T0000 horizontal bar chart series: [{ name: <org_id>, value: <count>, color? }]
 */
// PUBLIC_INTERFACE
export function projectCreateT0000Series(buckets = []) {
  // Support being called with either an array or an object { buckets: [...] }
  const src = Array.isArray(buckets) ? buckets : Array.isArray(buckets?.buckets) ? buckets.buckets : [];
  if (!Array.isArray(src)) return [];
  const colors = getOceanColors?.() || {};
  const color = colors.primary || '#2563EB';

  return src
    .filter(Boolean)
    .map((b, idx) => {
      const name = b.organization_id || b.key || b.label || `Org #${idx + 1}`;
      const value = typeof b.count === 'number' ? b.count : Number(b.count || 0);
      return { name, value, color };
    });
}
