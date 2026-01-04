import { shapeUsersProjectsBatchResponse } from "../shapeUsersProjectsBatchResponse";

describe("shapeUsersProjectsBatchResponse", () => {
  it("handles latest backend shape: data[userId] = { total_count, projects, name? }", () => {
    const userIds = ["u1", "u2"];
    const batchResponse = {
      success: true,
      tenant_id: "t1",
      data: {
        u1: { total_count: 3, projects: [{ project_id: "p1" }], name: "Alice" },
        u2: { total_count: "0", projects: [], user_name: "Bob" },
      },
    };

    const shaped = shapeUsersProjectsBatchResponse({ userIds, batchResponse });

    expect(shaped).toEqual({
      u1: { total_count: 3, projects: [{ project_id: "p1" }], name: "Alice" },
      u2: { total_count: 0, projects: [], user_name: "Bob" },
    });

    expect(typeof shaped.u1.total_count).toBe("number");
    expect(typeof shaped.u2.total_count).toBe("number");
  });
  test("supports shape A: data map arrays + totals map", () => {
    const out = shapeUsersProjectsBatchResponse({
      userIds: ["u1", "u2"],
      batchResponse: {
        success: true,
        data: {
          u1: [{ project_id: "p1" }, { project_id: "p2" }],
          u2: [],
        },
        totals: {
          u1: 5,
          u2: 0,
        },
      },
    });

    expect(out.u1.projects).toHaveLength(2);
    expect(out.u1.total_count).toBe(5);
    expect(out.u2.projects).toHaveLength(0);
    expect(out.u2.total_count).toBe(0);
  });

  test("supports shape B: data map objects with projects + total_count", () => {
    const out = shapeUsersProjectsBatchResponse({
      userIds: ["u1"],
      batchResponse: {
        data: {
          u1: { projects: [{ project_id: "p1" }], total_count: 3 },
        },
      },
    });

    expect(out.u1.projects).toHaveLength(1);
    expect(out.u1.total_count).toBe(3);
  });

  test("supports NEW backend shape: per-user objects under `data` and does not mis-treat `data` as an envelope", () => {
    const out = shapeUsersProjectsBatchResponse({
      userIds: ["u1", "u2"],
      batchResponse: {
        success: true,
        tenant_id: "T0000",
        data: {
          u1: { projects: [{ project_id: "p1" }], total_count: 4 },
          u2: { projects: [], total_count: 0 },
        },
      },
    });

    expect(out.u1.projects).toHaveLength(1);
    expect(out.u1.total_count).toBe(4);

    expect(out.u2.projects).toHaveLength(0);
    expect(out.u2.total_count).toBe(0);
  });

  test("supports shape C: data map arrays + total_count map", () => {
    const out = shapeUsersProjectsBatchResponse({
      userIds: ["u1"],
      batchResponse: {
        data: { u1: [{ project_id: "p1" }] },
        total_count: { u1: "7" },
      },
    });

    expect(out.u1.projects).toHaveLength(1);
    expect(out.u1.total_count).toBe(7);
  });

  test("supports shape H: data map arrays with no totals (falls back to projects.length)", () => {
    const out = shapeUsersProjectsBatchResponse({
      userIds: ["u1", "u2"],
      batchResponse: {
        success: true,
        tenant_id: "t1",
        data: {
          u1: [{ project_id: "p1" }, { project_id: "p2" }],
          u2: [],
        },
      },
    });

    expect(out.u1.projects).toHaveLength(2);
    expect(out.u1.total_count).toBe(2);
    expect(out.u2.projects).toHaveLength(0);
    expect(out.u2.total_count).toBe(0);
  });

  test("supports wrapped results under `items`", () => {
    const out = shapeUsersProjectsBatchResponse({
      userIds: ["u1"],
      batchResponse: {
        items: {
          u1: { projects: [{ project_id: "p1" }], total_count: "2" },
        },
      },
    });

    expect(out.u1.projects).toHaveLength(1);
    expect(out.u1.total_count).toBe(2);
  });

  test("supports extra data envelope: data.data + data.totals", () => {
    const out = shapeUsersProjectsBatchResponse({
      userIds: ["u1"],
      batchResponse: {
        data: {
          data: { u1: [{ project_id: "p1" }] },
          totals: { u1: 9 },
        },
      },
    });

    expect(out.u1.projects).toHaveLength(1);
    expect(out.u1.total_count).toBe(9);
  });

  test("supports totals nested in meta.data.totals", () => {
    const out = shapeUsersProjectsBatchResponse({
      userIds: ["u1"],
      batchResponse: {
        data: { u1: [{ project_id: "p1" }] },
        meta: { data: { totals: { u1: 4 } } },
      },
    });

    expect(out.u1.projects).toHaveLength(1);
    expect(out.u1.total_count).toBe(4);
  });

  test("returns default zeros for missing users", () => {
    const out = shapeUsersProjectsBatchResponse({
      userIds: ["u_missing"],
      batchResponse: { data: {} },
    });

    expect(out.u_missing.projects).toEqual([]);
    expect(out.u_missing.total_count).toBe(0);
  });
});
