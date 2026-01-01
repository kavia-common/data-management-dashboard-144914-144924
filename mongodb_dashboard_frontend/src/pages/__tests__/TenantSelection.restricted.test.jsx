import React from "react";
import { render, screen } from "@testing-library/react";
import TenantSelection from "../TenantSelection.jsx";
import { AuthProvider } from "../../context/AuthContext.jsx";

// Mock tenantClient API calls used by TenantSelection page
jest.mock("../../utils/tenantClient", () => ({
  fetchSessionTenants: jest.fn().mockResolvedValue([]),
  selectTenant: jest.fn().mockResolvedValue({ success: true }),
  normalizeTenantId: (t) => (t && typeof t === "object" ? t.tenant_id || t.id || t._id : t),
}));

describe("TenantSelection (restricted single-tenant)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("renders the tenant selection page shell", async () => {
    render(
      <AuthProvider>
        <TenantSelection />
      </AuthProvider>
    );

    // The page always renders this heading.
    expect(screen.getByText(/Select a tenant/i)).toBeInTheDocument();
  });
});
