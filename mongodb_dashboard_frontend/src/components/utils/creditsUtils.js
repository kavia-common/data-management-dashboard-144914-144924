//
// Utility helpers for reading and formatting Credits values from API responses.
//

/**
 * Safely extract credits used from a details response, preferring camelCase and
 * falling back to snake_case. Returns null if neither exists or not a finite number.
 */
export function getCreditsUsed(details) {
  if (!details || typeof details !== 'object') return null;
  const raw =
    details.creditsUsed ??
    details.credits_used ??
    // Some APIs may nest under data; try shallow nested fallback
    (details.data && (details.data.creditsUsed ?? details.data.credits_used));

  const num = typeof raw === 'string' ? Number(raw) : raw;
  return Number.isFinite(num) ? num : null;
}

/**
 * Format number with locale-aware formatting and fixed precision rules
 * to avoid scientific notation and keep UI consistent.
 */
export function formatCredits(value, locale = undefined) {
  if (value === null || value === undefined) return '—';
  try {
    // Use compact but precise formatting: up to 4 decimals if fractional exists
    const hasFraction = Math.abs(value % 1) > 0;
    const minimumFractionDigits = hasFraction ? 2 : 0;
    const maximumFractionDigits = hasFraction ? 4 : 0;
    return Number(value).toLocaleString(locale, {
      minimumFractionDigits,
      maximumFractionDigits,
    });
  } catch {
    return '—';
  }
}

/**
 * PUBLIC_INTERFACE
 * Format credits derived from USD costs (credits = total_cost * creditsPerUsd) with fixed precision.
 *
 * Why this exists:
 * - Multiplying floats (e.g., total_cost coming from JSON) can produce tiny binary rounding errors.
 * - The UI for "Credits Consumed" expects a stable decimal output (e.g., 64773196.3022).
 *
 * Behavior:
 * - Rounds to exactly `decimals` using decimal-safe scaling.
 * - Always renders exactly `decimals` fraction digits (default 4).
 */
export function formatCreditsFixedDecimals(value, decimals = 4, locale = undefined) {
  if (value === null || value === undefined) return '—';
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';

  const d = Number.isInteger(decimals) && decimals >= 0 ? decimals : 4;
  const factor = 10 ** d;
  const rounded = Math.round(num * factor) / factor;

  try {
    return rounded.toLocaleString(locale, {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    });
  } catch {
    // Fallback: non-locale fixed decimals
    return rounded.toFixed(d);
  }
}
