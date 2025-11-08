import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getStoredAuth, isAuthenticated as isAuthed, saveAuthSession, clearAuthSession } from '../config/auth';

const AuthContext = createContext({
  isAuthenticated: false,
  token: null,
  login: (token) => {},
  logout: () => {},
});

/**
 * The token stored in this context may be a JWT including fields like:
 * - sub (user id), name/email, and custom:tenant_id (tenant scoping).
 * Downstream UI can decode it client-side if needed to show display values,
 * but must not send tenant_id/user_id to the server; server scopes via token.
 */
// PUBLIC_INTERFACE
export function AuthProvider({ children }) {
  /** Context provider to expose authentication state based on localStorage. */
  const [auth, setAuth] = useState(() => getStoredAuth());

  useEffect(() => {
    // Sync with localStorage changes (e.g., other tabs)
    function onStorage(e) {
      if (e.key === 'auth') {
        try {
          setAuth(e.newValue ? JSON.parse(e.newValue) : null);
        } catch {
          setAuth(null);
        }
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value = useMemo(() => {
    return {
      isAuthenticated: isAuthed(),
      token: auth?.token || null,
      login: (token) => {
        saveAuthSession(token || null);
        setAuth(getStoredAuth());
      },
      logout: () => {
        clearAuthSession();
        setAuth(null);
      },
    };
  }, [auth]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// PUBLIC_INTERFACE
export function useAuth() {
  /** Hook to access auth context */
  return useContext(AuthContext);
}
