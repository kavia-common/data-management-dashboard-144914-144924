export function formatCurrency(value, currency = 'USD', locale = 'en-US') {
  try {
    if (typeof value !== 'number') return '—';
    return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 6 }).format(value);
  } catch {
    return String(value);
  }
}

// BACKWARD COMPAT: some code imports { formatCurrencyAmount }
export function formatCurrencyAmount(value, currency = 'USD', locale = 'en-US') {
  return formatCurrency(value, currency, locale);
}

// BACKWARD COMPAT: some code imports { formatUsdUpToSixDecimals }
export function formatUsdUpToSixDecimals(value) {
  return formatCurrency(value, 'USD', 'en-US');
}
