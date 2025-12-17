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
  const tenantId = useMemo(() => resolveOrganizationId({ auth }), [auth]);

  // Derive display name for the left-side title: prefer tenant id/name, fallback to "Dashboard"
  const leftTitle = tenantId && String(tenantId).trim() ? String(tenantId).trim() : "Dashboard";

  return (
    <header className="topbar app-headbar" role="banner">
      <div className="topbar-left">
        <div className="brand" aria-label={`${leftTitle}`}>
          {/* REQ-UI-LOGO-REPLACE: Reuse the same logo asset as Sidebar, placed before the title */}
          <img
            src={appLogo}
            alt="Company logo"
            className="brand-logo"
            style={{ height: 28, width: "auto", marginRight: 8, borderRadius: 8 }}
          />
          <span className="brand-title">{leftTitle}</span>
        </div>
      </div>

      {/* Remove explicit role/user labels per requirement; keep area for future actions if needed */}
      <div className="topbar-actions" role="group" aria-label="User actions" />
    </header>
  );
}
