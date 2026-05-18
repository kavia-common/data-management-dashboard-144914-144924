import { formatCurrency } from './formatCurrency'

/**
 * Strip "$" and commas then parse to number. Returns 0 if invalid.
 * PUBLIC_INTERFACE
 */
export function parseCurrencyToNumber(value) {
  if (value == null) return 0
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return 0
  const cleaned = value.replace(/\$/g, '').replace(/,/g, '').trim()
  const num = Number(cleaned)
  return Number.isFinite(num) ? num : 0
}

/**
 * PUBLIC_INTERFACE
 * Safe length of an array-ish value, defaults to 0.
 */
export function safeLength(arr) {
  return Array.isArray(arr) ? arr.length : 0
}

/**
 * PUBLIC_INTERFACE
 * Format number as currency using existing formatter.
 */
export function formatAsCurrency(num) {
  return formatCurrency(num)
}
