/**
 * Small utilities to prevent duplicate/racing requests for the same resource.
 */

/**
 * PUBLIC_INTERFACE
 * createSingleFlight
 * Creates a single-flight wrapper for an async factory function. Concurrent calls share the same
 * in-flight promise. Optionally supports AbortSignal; aborting a caller will not abort the shared
 * request unless you abort the provided shared AbortController explicitly.
 *
 * Notes:
 * - This is intentionally simple: it only dedupes concurrent calls and avoids reusing resolved data.
 * - It also supports "generation" semantics so callers can ignore stale results.
 *
 * @template T
 * @param {(ctx: {signal: AbortSignal}) => Promise<T>} factory async function to execute
 * @returns {{
 *   run: (opts?: { signal?: AbortSignal }) => Promise<T>,
 *   abort: () => void,
 *   reset: () => void,
 * }}
 */
export function createSingleFlight(factory) {
  let inFlight = null; // { promise, controller, gen }
  let gen = 0;

  function reset() {
    inFlight = null;
  }

  function abort() {
    if (inFlight?.controller) {
      inFlight.controller.abort();
    }
    inFlight = null;
  }

  async function run(opts = {}) {
    const callerSignal = opts.signal;

    // If we have an in-flight request, share it.
    if (inFlight?.promise) {
      // If caller already aborted, fail fast with AbortError to allow quiet handling.
      if (callerSignal?.aborted) {
        const err = new DOMException('Aborted', 'AbortError');
        throw err;
      }

      // Tie caller abort to "ignore result" behavior: caller sees AbortError, but shared request continues.
      if (callerSignal) {
        return Promise.race([
          inFlight.promise,
          new Promise((_, reject) => {
            callerSignal.addEventListener(
              'abort',
              () => reject(new DOMException('Aborted', 'AbortError')),
              { once: true }
            );
          }),
        ]);
      }

      return inFlight.promise;
    }

    // Start a new request.
    gen += 1;
    const myGen = gen;
    const controller = new AbortController();

    // If caller aborts, we *do not* abort the shared request; we only let that caller bail out.
    const promise = (async () => {
      try {
        const result = await factory({ signal: controller.signal });
        return result;
      } finally {
        // Only clear if it's still the same generation (avoid races).
        if (inFlight?.gen === myGen) {
          inFlight = null;
        }
      }
    })();

    inFlight = { promise, controller, gen: myGen };

    // Respect caller abort as a "no-op" for that caller.
    if (callerSignal) {
      if (callerSignal.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      return Promise.race([
        promise,
        new Promise((_, reject) => {
          callerSignal.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true }
          );
        }),
      ]);
    }

    return promise;
  }

  return { run, abort, reset };
}
