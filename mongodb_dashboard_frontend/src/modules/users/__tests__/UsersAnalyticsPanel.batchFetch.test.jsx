import React from "react";
import { render, act } from "@testing-library/react";

// Mock recharts (ResponsiveContainer uses ResizeObserver in jsdom)
jest.mock("recharts", () => {
  const React = require("react");
  const passthrough = ({ children }) => <div>{children}</div>;
  return {
    ResponsiveContainer: passthrough,
    BarChart: passthrough,
    Bar: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: () => null,
  };
});

// Mock tenant
jest.mock("../../../utils/tenantClient", () => ({
  getActiveTenant: () => "org_test",
}));

// Mock users hook to provide a stable set of users
jest.mock("../../../hooks/useUsers", () => ({
  useUsers: () => ({
    users: [{ _id: "u1", name: "U1" }, { _id: "u2", name: "U2" }],
    loading: false,
    error: null,
  }),
}));

const mockGetUsersProjectsBatch = jest.fn().mockResolvedValue({
  success: true,
  data: { u1: [], u2: [] },
});

jest.mock("../../../api/users", () => ({
  getUsersProjectsBatch: (...args) => mockGetUsersProjectsBatch(...args),
}));

import UsersAnalyticsPanel from "../UsersAnalyticsPanel";

describe("UsersAnalyticsPanel batch fetching", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockGetUsersProjectsBatch.mockClear();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("fetches projects via a single consolidated request per debounced filter change", async () => {
    render(<UsersAnalyticsPanel defaultDays={7} />);

    // Debounce is 250ms; advance timers to trigger the effect
    await act(async () => {
      jest.advanceTimersByTime(260);
    });

    expect(mockGetUsersProjectsBatch).toHaveBeenCalledTimes(1);

    const [userIds, params] = mockGetUsersProjectsBatch.mock.calls[0];
    expect(userIds).toEqual(["u1", "u2"]);
    expect(params).toEqual(
      expect.objectContaining({
        organization_id: "org_test",
      })
    );
    expect(typeof params.from).toBe("string");
    expect(typeof params.to).toBe("string");
  });
});
