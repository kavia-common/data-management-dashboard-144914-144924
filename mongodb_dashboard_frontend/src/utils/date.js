export function formatShortDateLabel(yyyy_mm_dd) {
  try {
    if (!yyyy_mm_dd) return '';
    const [y, m, d] = yyyy_mm_dd.split('-');
    return `${m}/${d}`;
  } catch {
    return '';
  }
}
