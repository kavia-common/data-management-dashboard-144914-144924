import { adaptProjectCreateSummary } from './projectCreateSummaryAdapter';
import getOceanColors from '../theme/colors';

/**
 * PUBLIC_INTERFACE
 * projectCreateT0000Series
 * Shapes series for the T0000 horizontal bar chart from the generic projects summary response.
 */
export function projectCreateT0000Series(raw) {
  const adapted = adaptProjectCreateSummary(raw);
  const colorTokens = getOceanColors() || {};
  const colors = { primary: colorTokens.primary || '#2563EB', secondary: colorTokens.secondary || '#F59E0B' };

  const labels = adapted.buckets.map((b) => b.label);
  const values = adapted.buckets.map((b) => b.count);

  return {
    labels,
    datasets: [
      {
        label: 'Projects created',
        data: values,
        backgroundColor: labels.map(() => colors.primary),
        borderColor: labels.map(() => colors.primary),
        borderWidth: 1,
      },
    ],
    meta: {
      total: adapted.total,
      range: adapted.range,
      start_date: adapted.start_date,
      end_date: adapted.end_date,
    },
  };
}
