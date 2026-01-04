/**
 * PUBLIC_INTERFACE
 * shapeUsersProjectsBatchResponse
 *
 * Normalizes the evolving `POST /api/users/projects` batch response into a stable per-user map:
 *   { [userId]: { projects: Array, total_count: number } }
 *
 * Supported batch response shapes (observed variants):
 *  A) { data: { [userId]: Array<Project> }, totals?: { [userId]: number } }
 *  B) { data: { [userId]: { projects: Array<Project>, total_count: number } } }
 *  C) { data: { [userId]: Array<Project> }, total_count?: { [userId]: number } }
 *  D) { data: { [userId]: Array<Project>, totals: { [userId]: number } } }   <-- totals nested under data
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
  // Also accept nested "data.items" / "data.results" envelope variants.
  const dataMapRaw =
    (batchResponse?.data && typeof batchResponse.data === "object" && batchResponse.data) ||
    (batchResponse?.items && typeof batchResponse.items === "object" && batchResponse.items) ||
    (batchResponse?.results &&
      typeof batchResponse.results === "object" &&
      batchResponse.results) ||
    (batchResponse?.data?.items &&
      typeof batchResponse.data.items === "object" &&
      batchResponse.data.items) ||
    (batchResponse?.data?.results &&
      typeof batchResponse.data.results === "object" &&
      batchResponse.data.results) ||
    {};

  // Accept totals under a few aliases, and importantly, accept nested totals under `data` and `meta`.
  // This prevents the chart from showing "empty bars" when totals are present but not found.
  const totalsMapCandidate =
    (batchResponse?.totals && typeof batchResponse.totals === "object" && batchResponse.totals) ||
    (batchResponse?.counts && typeof batchResponse.counts === "object" && batchResponse.counts) ||
    (batchResponse?.total_count &&
      typeof batchResponse.total_count === "object" &&
      batchResponse.total_count) ||
    (batchResponse?.meta?.totals && typeof batchResponse.meta.totals === "object" && batchResponse.meta.totals) ||
    (batchResponse?.meta?.counts && typeof batchResponse.meta.counts === "object" && batchResponse.meta.counts) ||
    (batchResponse?.meta?.total_count &&
      typeof batchResponse.meta.total_count === "object" &&
      batchResponse.meta.total_count) ||
    (dataMapRaw?.totals && typeof dataMapRaw.totals === "object" && dataMapRaw.totals) ||
    (dataMapRaw?.counts && typeof dataMapRaw.counts === "object" && dataMapRaw.counts) ||
    (dataMapRaw?.total_count &&
      typeof dataMapRaw.total_count === "object" &&
      dataMapRaw.total_count) ||
    {};

  // Ensure we only treat it as a map.
  const totalsMap = totalsMapCandidate && typeof totalsMapCandidate === "object" ? totalsMapCandidate : {};

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

    // Shape A/C/D: data[uid] is an array of projects + totals stored separately
    const projects = Array.isArray(raw) ? raw : [];
    const totalCount = Number.isFinite(Number(totalsMap?.[uid])) ? Number(totalsMap[uid]) : 0;

    // Always output the exact object shape expected by the chart: { projects: [], total_count: number }
    // This also zero-fills users missing from the response.
    out[uid] = { projects, total_count: totalCount };
  }

  return out;
}
