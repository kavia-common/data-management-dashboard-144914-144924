import { shapeUsersProjectsBatchResponse } from "../shapeUsersProjectsBatchResponse";

describe("shapeUsersProjectsBatchResponse", () => {
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

  test("returns default zeros for missing users", () => {
    const out = shapeUsersProjectsBatchResponse({
      userIds: ["u_missing"],
      batchResponse: { data: {} },
    });

    expect(out.u_missing.projects).toEqual([]);
    expect(out.u_missing.total_count).toBe(0);
  });
});
