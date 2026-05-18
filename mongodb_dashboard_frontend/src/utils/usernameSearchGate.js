/**
 * UsernameSearchGate
 *
 * This module centralizes the contract for when the UI should issue a server-side
 * search request for a username.
 *
 * Rationale:
 * - Some backends treat text-search queries differently for partial vs full terms.
 * - To avoid noisy requests and confusing "no results while typing", the Sessions
 *   table should only query when the user has entered the full username.
 *
 * Contract:
 * Inputs:
 * - rawInput: unknown (typically string)
 *
 * Output:
 * - { shouldSearch: boolean, normalized: string }
 *
 * Invariants:
 * - normalized is always a trimmed string with collapsed whitespace.
 * - shouldSearch is true only when normalized looks like a full name:
 *   - at least 2 tokens (e.g. "First Last"), OR
 *   - a single token length >= 5 (e.g. "Aditi")
 *
 * Errors:
 * - No throws; defensive normalization.
 */

// PUBLIC_INTERFACE
export function evaluateUsernameSearchInput(rawInput) {
  /**
   * Decide whether to execute a username search.
   *
   * @param {unknown} rawInput
   * @returns {{ shouldSearch: boolean, normalized: string }}
   */
  const normalized = String(rawInput ?? "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return { shouldSearch: false, normalized: "" };

  const tokens = normalized.split(" ").filter(Boolean);

  // Heuristic gate:
  // - If user enters "First Last" (2+ tokens), consider it "full".
  // - Otherwise require a minimum length for a single token.
  const shouldSearch = tokens.length >= 2 || normalized.length >= 5;

  return { shouldSearch, normalized };
}
