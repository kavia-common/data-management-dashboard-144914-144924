import React, { useMemo } from "react";
import appLogo from "../../assets/logo/app-logo-2025.png";
import { useAuth } from "../../context/AuthContext.jsx";
import { resolveOrganizationId } from "../../utils/orgContext";

/**
 * PUBLIC_INTERFACE
 * Topbar
 * Header with brand and user info. No sidebar toggle controls (sidebar is fixed and always visible).
 */
// PUBLIC_INTERFACE
export default function Topbar() {
  /** Top navigation bar with brand mark/wordmark and dynamic tenant name. */
  const auth = useAuth?.() || {};

  // Resolve the active tenant id from shared context/token utils (used for fallback display)
  const tenantId = useMemo(() => resolveOrganizationId({ auth }), [auth]);

  // Prefer tenant_name from login-provided auth state
  const nameFromAuth = auth?.user?.tenant_name || null;

  const localNameHints =
    auth?.tenant?.name ||
    auth?.tenantName ||
    auth?.organizationName ||
    auth?.user?.organizationName ||
    auth?.user?.tenantName ||
    null;

  const effectiveName =
    (nameFromAuth && String(nameFromAuth).trim()) ||
    (localNameHints && String(localNameHints).trim()) ||
    (tenantId && String(tenantId).trim()) ||
    null;

  const leftTitle = effectiveName
    ? `${effectiveName} Tenant Dashboard`
    : "Dashboard";

  return (
    <header className="topbar app-headbar" role="banner">
      <div className="topbar-left">
        <div className="brand" aria-label={`${leftTitle}`}>
          <img
            src={appLogo}
            alt="Company logo"
            className="brand-logo"
            style={{ height: 28, width: "auto", marginRight: 8, borderRadius: 8 }}
          />
          <span className="brand-title">{leftTitle}</span>
        </div>
      </div>

      <div className="topbar-actions" role="group" aria-label="User actions" />
    </header>
  );
}
