/**
 * PUBLIC_INTERFACE
 * shapeUsersProjectsBatchResponse
 *
 * Normalizes the evolving `POST /api/users/projects` batch response into a stable per-user map:
 *   { [userId]: { projects: Array, total_count: number } }
 *
 * Supported batch response shapes:
 *  A) { data: { [userId]: Array<Project> }, totals?: { [userId]: number } }
 *  B) { data: { [userId]: { projects: Array<Project>, total_count: number } } }
 *  C) { data: { [userId]: Array<Project> }, total_count?: { [userId]: number } }
 *
 * @param {object} params
 * @param {Array<string>} params.userIds - The list of userIds requested.
 * @param {any} params.batchResponse - The raw response returned by getUsersProjectsBatch().
 * @returns {Record<string, {projects: Array, total_count: number}>}
 */
export function shapeUsersProjectsBatchResponse({ userIds, batchResponse }) {
  const ids = Array.isArray(userIds) ? userIds.map(String).filter(Boolean) : [];

  // Some backend handlers may wrap results under different keys.
  // Prefer `data` (current contract), but accept `items`/`results` as fallbacks.
  const dataMapRaw =
    (batchResponse?.data && typeof batchResponse.data === "object" && batchResponse.data) ||
    (batchResponse?.items && typeof batchResponse.items === "object" && batchResponse.items) ||
    (batchResponse?.results && typeof batchResponse.results === "object" && batchResponse.results) ||
    {};

  // Accept totals under `totals` or `total_count` map; also accept `counts` as a possible alias.
  const totalsMap =
    (batchResponse?.totals && typeof batchResponse.totals === "object" && batchResponse.totals) ||
    (batchResponse?.counts && typeof batchResponse.counts === "object" && batchResponse.counts) ||
    (batchResponse?.total_count &&
      typeof batchResponse.total_count === "object" &&
      batchResponse.total_count) ||
    {};

  const out = {};
  for (const uid of ids) {
    const raw = dataMapRaw?.[uid];

    // Shape B: data[uid] is an object { projects, total_count }
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const projects = Array.isArray(raw?.projects) ? raw.projects : [];
      const totalCount =
        typeof raw?.total_count === "number"
          ? raw.total_count
          : Number.isFinite(Number(raw?.total_count))
            ? Number(raw.total_count)
            : Number.isFinite(Number(totalsMap?.[uid]))
              ? Number(totalsMap[uid])
              : 0;

      out[uid] = { ...raw, projects, total_count: totalCount };
      continue;
    }

    // Shape A/C: data[uid] is an array of projects + totals stored separately
    const projects = Array.isArray(raw) ? raw : [];
    const totalCount = Number.isFinite(Number(totalsMap?.[uid])) ? Number(totalsMap[uid]) : 0;

    // Always output the exact object shape expected by the chart: { projects: [], total_count: number }
    out[uid] = { projects, total_count: totalCount };
  }

  return out;
}
