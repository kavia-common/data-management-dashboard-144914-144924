import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import PropTypes from "prop-types";

/**
 * PUBLIC_INTERFACE
 * TenantFilterProvider
 * Provides a single source of truth for the selected tenant filter in Users Analytics.
 *
 * The provider exposes:
 * - selectedTenantId: string | null  (null means "All tenants")
 * - setSelectedTenantId: (tenantId: string | null) => void
 *
 * Notes:
 * - This is intentionally separate from the app-level "active tenant" selection,
 *   because Users Analytics needs an "All tenants" option for super-admin/global views.
 */
const TenantFilterContext = createContext(null);

// PUBLIC_INTERFACE
export function TenantFilterProvider({ children, defaultTenantId = null }) {
  const [selectedTenantId, _setSelectedTenantId] = useState(defaultTenantId);

  const setSelectedTenantId = useCallback((tenantId) => {
    // Normalize empty-string to null for "All tenants"
    const normalized = tenantId ? String(tenantId) : null;
    _setSelectedTenantId(normalized);
  }, []);

  const value = useMemo(
    () => ({
      selectedTenantId,
      setSelectedTenantId,
    }),
    [selectedTenantId, setSelectedTenantId]
  );

  return <TenantFilterContext.Provider value={value}>{children}</TenantFilterContext.Provider>;
}

TenantFilterProvider.propTypes = {
  children: PropTypes.node,
  defaultTenantId: PropTypes.string,
};

// PUBLIC_INTERFACE
export function useTenantFilter() {
  const ctx = useContext(TenantFilterContext);
  if (!ctx) throw new Error("useTenantFilter must be used within a TenantFilterProvider");
  return ctx;
}
