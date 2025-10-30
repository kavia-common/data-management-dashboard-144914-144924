 /**
  * PUBLIC_INTERFACE
  * buildQueryString
  * Converts a flat object into a query string starting with '?'.
  * Omits null/undefined/empty-string values.
  */
export function buildQueryString(params = {}) {
  /** This is a public function. */
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== ""
  );
  if (entries.length === 0) return "";
  const usp = new URLSearchParams();
  for (const [k, v] of entries) {
    usp.set(k, String(v));
  }
  return `?${usp.toString()}`;
}
