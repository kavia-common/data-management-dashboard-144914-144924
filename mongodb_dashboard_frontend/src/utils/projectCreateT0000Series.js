import getOceanColors from '../theme/colors';

/**
 * PUBLIC_INTERFACE
 * toT0000Series
 * Map T0000 response [{ organization_id, count }] to horizontal bar chart series [{ name, value }]
 */
// PUBLIC_INTERFACE
export function toT0000Series(items = []) {
  const colors = getOceanColors?.() || {};
  const color = colors.primary || '#2563EB';
  const series = (items || []).map((it, idx) => ({
    name: it?.organization_id || `Org #${idx + 1}`,
    value: typeof it?.count === 'number' ? it.count : 0,
    color,
  }));
  return series;
}
