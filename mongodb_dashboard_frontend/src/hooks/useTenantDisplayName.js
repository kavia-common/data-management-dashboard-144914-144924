import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { fetchUserOrganizationsByEmail } from "../api/authClient";

/**
 * PUBLIC_INTERFACE
 * useTenantDisplayName
 * Hook to resolve and cache the current tenant display name based on the logged-in user's email.
 *
 * Behavior:
 * - Derives user's email from available auth context or session fallbacks (localStorage).
 * - Calls GET https://kaviabeta-worktool.cloud.kavia.ai/api/auth/user-organizations?email=<encodedEmail>
 *   via fetchUserOrganizationsByEmail (which already routes to the external domain).
 * - Extracts organizations[0].name as the display name (simple heuristic).
 * - Exposes { tenantName, loading, error, sourceEmail }
 * - Graceful fallbacks: when email missing or API fails, returns null tenantName, loading false, and error if relevant.
 *
 * Caching:
 * - Simple in-memory cache keyed by email to avoid repeated calls across components.
 */
const nameCache = new Map();

function deriveEmailFromAuth(auth) {
  // Try a few common auth shapes employed in the app
  const candidates = [
    auth?.user?.email,
    auth?.email,
    auth?.session?.email,
    // sometimes auth provider stores serialized user in localStorage
    tryGetStoredUserEmail(),
  ].filter(Boolean);

  const first = candidates.find((e) => typeof e === "string" && e.includes("@"));
  return first || null;
}

function tryGetStoredUserEmail() {
  try {
    const keys = ["user", "userInfo", "auth", "session"];
    for (const k of keys) {
      const raw = localStorage.getItem(k) || sessionStorage.getItem(k);
      if (!raw) continue;
      try {
        const obj = JSON.parse(raw);
        const email = obj?.email || obj?.user?.email || obj?.profile?.email;
        if (email && typeof email === "string") return email;
      } catch {
        // ignore parse errors and try next
      }
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

export default function useTenantDisplayName() {
  const auth = useAuth?.() || {};
  const [tenantName, setTenantName] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const sourceEmail = useMemo(() => deriveEmailFromAuth(auth), [auth]);
  const emailRef = useRef(sourceEmail);

  useEffect(() => {
    emailRef.current = sourceEmail;
  }, [sourceEmail]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setError(null);

      if (!sourceEmail) {
        // No email available -> cannot fetch; just keep null name
        setLoading(false);
        setTenantName(null);
        return;
      }

      // Cached?
      if (nameCache.has(sourceEmail)) {
        setTenantName(nameCache.get(sourceEmail));
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const resp = await fetchUserOrganizationsByEmail(sourceEmail);
        const orgs = Array.isArray(resp?.organizations) ? resp.organizations : [];
        const first = orgs[0] || null;
        const name =
          (first && (first.name || first.display_name || first.title)) || null;

        if (!cancelled) {
          nameCache.set(sourceEmail, name);
          setTenantName(name);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e);
          setTenantName(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [sourceEmail]);

  return { tenantName, loading, error, sourceEmail };
}
