import { getUserSessionCount } from '../api/sessionCounts';

/**
 * PUBLIC_INTERFACE
 * fetchTotalSessionsForUser
 * Convenience wrapper around api/sessionCounts for components that prefer services access.
 * Returns a number (count) or 0 on failure.
 */
export async function fetchTotalSessionsForUser(userId) {
  try {
    return await getUserSessionCount(userId);
  } catch {
    return 0;
  }
}

export default {
  fetchTotalSessionsForUser,
};
