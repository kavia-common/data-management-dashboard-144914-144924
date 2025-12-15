//
// Dev diagnostics: optional console/network capture to aid manual verification.
//
// Usage (optional):
//   import { installDevDiagnostics } from "./utils/devDiagnostics";
//   installDevDiagnostics({ enabled: process.env.NODE_ENV !== "production" });
//
// This module is safe to import; it does nothing unless enabled=true.
//

/**
 * Replace the global console methods with wrappers that also emit structured logs.
 * @param {Console} c
 * @returns {void}
 */
function wrapConsole(c) {
  if (!c || c.__wrapped_by_dev_diag__) return;
  const methods = ["error", "warn"];
  methods.forEach((m) => {
    const original = c[m];
    c[m] = function (...args) {
      try {
        // Emit a structured marker to help locate issues in manual runs
        original.call(c, `[DEV-DIAG:${m.toUpperCase()}]`, ...args);
      } catch {
        // best-effort
      }
      return original.apply(c, args);
    };
  });
  c.__wrapped_by_dev_diag__ = true;
}

/**
 * Wrap window.fetch to log failing requests (4xx/5xx/network errors) including URL and status.
 * @param {Window} win
 * @returns {void}
 */
function wrapFetch(win) {
  if (!win || win.__fetch_wrapped_by_dev_diag__) return;
  const original = win.fetch ? win.fetch.bind(win) : null;
  if (!original) return;

  win.fetch = async (input, init) => {
    try {
      const res = await original(input, init);
      if (!res.ok) {
        // Attempt to capture the request URL and status
        const url = typeof input === "string" ? input : (input && input.url) || "unknown";
        // Annotate common endpoints of interest
        const isUsersSummary = url.includes("/api/users/summary");
        const isTenantSummary = url.includes("/api/users/tenant-summary");
        const tag = isUsersSummary ? "USERS_SUMMARY" : isTenantSummary ? "TENANT_SUMMARY" : "API";
        console.error(`[DEV-DIAG:FETCH:${tag}]`, { url, status: res.status, statusText: res.statusText });
      }
      return res;
    } catch (err) {
      const url = typeof input === "string" ? input : (input && input.url) || "unknown";
      console.error("[DEV-DIAG:FETCH:NETWORK]", { url, error: err && err.message ? err.message : String(err) });
      throw err;
    }
  };
  win.__fetch_wrapped_by_dev_diag__ = true;
}

/**
 * PUBLIC_INTERFACE
 * Install dev diagnostics. No-ops in production by default unless explicitly enabled.
 * @param {{ enabled?: boolean }} opts
 */
export function installDevDiagnostics(opts = {}) {
  const { enabled = false } = opts;
  if (!enabled) return;

  try {
    wrapConsole(window.console);
  } catch {
    // ignore
  }

  try {
    wrapFetch(window);
  } catch {
    // ignore
  }

  try {
    window.addEventListener("error", (event) => {
      // Capture unhandled errors surfaced to window
      console.error("[DEV-DIAG:UNCAUGHT]", { message: event.message, filename: event.filename, lineno: event.lineno, colno: event.colno });
    });
    window.addEventListener("unhandledrejection", (event) => {
      console.error("[DEV-DIAG:UNHANDLED_REJECTION]", { reason: event.reason });
    });
  } catch {
    // ignore
  }

  // Helpful startup marker
  try {
    console.warn("[DEV-DIAG] Installed dev diagnostics (console/fetch wrappers active).");
  } catch {
    // ignore
  }
}
