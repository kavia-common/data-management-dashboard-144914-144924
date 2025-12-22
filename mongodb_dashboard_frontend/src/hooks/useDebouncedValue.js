 /**
  * PUBLIC_INTERFACE
  * useDebouncedValue
  * Debounces a changing value by the specified delay (ms).
  */
import { useEffect, useState } from "react";

/**
 * PUBLIC_INTERFACE
 * Debounce a rapidly-changing value.
 * Returns a debounced version of the value that only updates after the given delay.
 * Default delay = 300ms.
 */
export function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debounced;
}

// PUBLIC_INTERFACE
// Provide default export for compatibility where imported as default
export default useDebouncedValue;
