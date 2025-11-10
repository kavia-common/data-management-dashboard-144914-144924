import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { setTheme } from "./theme";

// Apply dark theme globally based on design tokens
if (typeof window !== "undefined") {
  setTheme("dark");
}

// Add runtime handler to surface dynamic import/ChunkLoadError problems clearly.
// Suggests a hard reload if a chunk fails to load (often caused by stale caches or changed chunk hashes).
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event && event.reason;
    const msg = reason && (reason.message || String(reason));
    const isChunkError =
      reason &&
      (reason.name === "ChunkLoadError" ||
        /loading chunk \d+ failed/i.test(msg || "") ||
        /dynamic import/i.test(msg || ""));

    if (isChunkError) {
      // eslint-disable-next-line no-console
      console.error("Detected chunk load failure. This can happen after a deploy when the browser has a stale bundle cached. A hard reload typically fixes it.", reason);
      // Optional: prompt the user to reload to fetch fresh chunks
      if (process.env.NODE_ENV === "production") {
        // Avoid blocking dev flow; in prod politely suggest reload
        // eslint-disable-next-line no-alert
        const shouldReload = window.confirm("The application was updated. Reload now to continue?");
        if (shouldReload) {
          window.location.reload();
        }
      }
    }
  });
}

/**
 * Optional dev-only demo: dynamic import of ./utils/crypto.
 * ChunkLoadError can happen in dev if HMR serves stale chunks; to reduce surface area,
 * only run when an explicit env flag is set and defer until after initial render.
 */
if (
  typeof process !== "undefined" &&
  process.env &&
  process.env.NODE_ENV === "development" &&
  String(process.env.REACT_APP_ENABLE_CRYPTO_DEMO || "").toLowerCase() === "true"
) {
  // Defer until after initial paint to avoid interfering with app mount
  setTimeout(() => {
    import("./utils/crypto")
      .then((mod) => {
        try {
          if (
            mod &&
            typeof mod.encryptTenantId === "function" &&
            typeof mod.isTenantSaltValid === "function"
          ) {
            if (mod.isTenantSaltValid()) {
              // eslint-disable-next-line no-console
              console.log(mod.encryptTenantId("T0002"));
            } else {
              // eslint-disable-next-line no-console
              console.warn("Skipping encryptTenantId demo: tenant salt is not configured.");
            }
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn("encryptTenantId demo failed", e);
        }
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.warn("Optional crypto demo import failed (safe to ignore in dev):", err && err.message ? err.message : err);
      });
  }, 0);
}

/**
 * Configure a Data Router to enable React Router v7-compatible behaviors.
 *
 * future.v7_startTransition:
 *   Wraps navigations in React.startTransition for React 18+ concurrent hints.
 *
 * future.v7_relativeSplatPath:
 *   Changes how relative paths resolve from splat (*) routes to match upcoming v7.
 *
 * Docs:
 * - https://reactrouter.com/en/main/routers/create-browser-router#future
 * - https://reactrouter.com/en/main/upgrading/v7 (when available)
 */
const router = createBrowserRouter(
  [
    // Delegate the entire route tree to <App /> which renders <Routes /> and pages.
    // This allows us to adopt future flags without reworking existing route structure.
    { path: "/*", element: <App /> },
  ],
  {
    future: {
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    },
  }
);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <AuthProvider>
      {/* RouterProvider also accepts a future prop for flags that affect runtime behavior */}
      <RouterProvider
        router={router}
        future={{
          v7_startTransition: true,
        }}
      />
    </AuthProvider>
  </React.StrictMode>
);
