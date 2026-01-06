import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { getStoredAuth } from '../config/auth';

/**
 * PUBLIC_INTERFACE
 * useSessionUserId
 *
 * Returns the currently signed-in user's id as known by the frontend auth/session
 * storage. This is used to scope API calls (e.g., llm_costs) to the signed-in
 * user rather than the user selected in the Users table.
 *
 * Priority of sources:
 *  1) AuthContext (when populated)
 *  2) Persisted auth storage (localStorage via getStoredAuth())
 *
 * @returns {string} userId or empty string when unavailable.
 */
export default function useSessionUserId() {
  const authCtx = useAuth?.() || {};
  const stored = getStoredAuth?.() || null;

  return useMemo(() => {
    const fromCtx =
      authCtx?.user?._id ||
      authCtx?.user?.id ||
      authCtx?.user?.user_id ||
      authCtx?.user?.userId;

    const fromStored =
      stored?.user?._id ||
      stored?.user?.id ||
      stored?.user?.user_id ||
      stored?.user?.userId;

    return String(fromCtx || fromStored || '');
  }, [authCtx?.user, stored]);
}
