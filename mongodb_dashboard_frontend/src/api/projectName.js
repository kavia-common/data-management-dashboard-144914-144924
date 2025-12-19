/**
 * PUBLIC_INTERFACE
 * getProjectName
 * Resolve a project's display name from App Deployments by projectId.
 * Uses backend route: GET /api/app-deployments/project/{projectId}/name
 *
 * @param {string} projectId
 * @returns {Promise<{ projectId: string, projectName: string | null }>}
 */
import { getApiClient } from "./baseClient";

export async function getProjectName(projectId) {
  if (!projectId) {
    return { projectId: "", projectName: null };
  }
  const res = await getApiClient().get(
    `/api/app-deployments/project/${encodeURIComponent(projectId)}/name`
  );
  const payload = res?.data ?? res;
  // Normalize to expected shape
  if (payload && typeof payload === "object") {
    return {
      projectId: String(payload.projectId ?? projectId),
      projectName:
        payload.projectName === undefined ? null : payload.projectName,
    };
  }
  return { projectId: String(projectId), projectName: null };
}
