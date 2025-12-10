import { getApiClient } from "./index";

/**
 * PUBLIC_INTERFACE
 * getUserBasic
 * Fetch minimal user info by MongoDB ObjectId.
 * GET /api/users/:id -> { id, name }
 *
 * @param {string} userId - MongoDB ObjectId as string
 * @returns {Promise<{ id: string, name: string|null }>}
 */
export async function getUserBasic(userId) {
  const api = getApiClient();
  if (!userId) throw new Error("userId is required");
  try {
    // Always include /api prefix and let the client handle base + auth + tenant propagation
    const res = await api.get(`/api/users/${encodeURIComponent(userId)}`);
    return res.data;
  } catch (err) {
    const status = err?.response?.status || err?.status;
    if (status === 404) {
      return { id: String(userId), name: null };
    }
    throw err;
  }
}
