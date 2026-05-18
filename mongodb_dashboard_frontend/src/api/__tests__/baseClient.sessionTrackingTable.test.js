import { getApiClient } from "../baseClient";

jest.mock("../config", () => ({
  getApiBase: () => "http://example.test:3001/api",
}));

jest.mock("../authTokenProvider", () => ({
  buildAuthHeaders: (h) => h,
  getOrganizationId: () => "T0000",
}));

jest.mock("../tenantScope", () => ({
  applyTenantScopeToRequest: (x) => x,
  resolveEffectiveTenantId: (x) => x,
}));

describe("baseClient session-tracking table request composition", () => {
  beforeEach(() => {
    global.fetch = jest.fn(async (url) => {
      return {
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: async () => ({ success: true, data: [], meta: { page: 1, limit: 10, total: 0 } }),
        text: async () => "",
      };
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test("GET /api/session-tracking/table preserves q and scopes via tenant_id", async () => {
    const client = getApiClient();

    await client.get("/api/session-tracking/table", {
      params: { page: 1, limit: 10, q: "Aditi S" },
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const calledUrl = String(global.fetch.mock.calls[0][0]);

    // Should include q and tenant_id derived from getOrganizationId()
    expect(calledUrl).toContain("/api/session-tracking/table?");
    expect(calledUrl).toContain("q=Aditi+S");
    expect(calledUrl).toContain("tenant_id=T0000");

    // Should NOT inject organization_id for session-tracking list endpoints
    expect(calledUrl).not.toContain("organization_id=");
  });
});
