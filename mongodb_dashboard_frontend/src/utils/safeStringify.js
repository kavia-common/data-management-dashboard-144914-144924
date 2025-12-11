//
// PUBLIC_INTERFACE
// safeStringify
/** Safely serialize a value to JSON, omitting functions, DOM nodes, and circular references. */
export function safeStringify(value, space = 0) {
  /**
   * Returns a JSON string for a given value while:
   * - Skipping functions
   * - Skipping DOM nodes / React elements (HTMLElement / Element / Node)
   * - Skipping React Fiber and other circular references via WeakSet
   * - Handling errors gracefully
   */
  try {
    const seen = new WeakSet();
    const isDomNode = (v) => {
      try {
        if (v == null || typeof v !== 'object') return false;
        // Best-effort checks without depending on window existence in SSR
        if (typeof Element !== 'undefined' && v instanceof Element) return true;
        if (typeof Node !== 'undefined' && v instanceof Node) return true;
        // Heuristic: React elements have $$typeof and props with children; skip
        if (v.$$typeof && v.props) return true;
        return false;
      } catch {
        return false;
      }
    };
    const replacer = (_k, v) => {
      if (typeof v === 'function') return undefined;
      if (isDomNode(v)) return undefined;
      if (v && typeof v === 'object') {
        if (seen.has(v)) return undefined;
        seen.add(v);
      }
      return v;
    };
    return JSON.stringify(value, replacer, space);
  } catch {
    try {
      return JSON.stringify({ message: 'Unserializable value dropped' });
    } catch {
      return '""';
    }
  }
}
