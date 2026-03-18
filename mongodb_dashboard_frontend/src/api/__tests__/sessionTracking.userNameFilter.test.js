import { listSessions } from "../baseClient";

describe("Session Tracking - user_name filtering", () => {
  beforeEach(() => {
    // Minimal org scope for ensureScopedQueryParams; baseClient uses this.
    // NOTE: authTokenProvider.getOrganizationId() reads from this key.
    window.localStorage.setItem("org_id", "orgTest");
  });

  afterEach(() => {
    window.localStorage.clear();
    global.fetch = undefined;
  });

  test("listSessions forwards User_name/user_name query param (used by backend for case-insensitive match)", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({ success: true, data: [], meta: { page: 1, limit: 10, total: 0 } }),
      text: async () => "",
    }));

    await listSessions({ page: 1, limit: 10, user_name: "aLi" });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url] = global.fetch.mock.calls[0];

    // Must include both tenant scope and the dedicated user_name filter param.
    expect(String(url)).toContain("/api/session-tracking?");
    expect(String(url)).toContain("tenant_id=");
    expect(String(url)).toContain("user_name=aLi");
  });
});
