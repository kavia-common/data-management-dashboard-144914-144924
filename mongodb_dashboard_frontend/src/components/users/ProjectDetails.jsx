import React, { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { getUserProjects, cancelUserProjectsRequest } from '../../api/users';
import { useAuth } from '../../context/AuthContext';

/**
 * PUBLIC_INTERFACE
 * ProjectDetails
 * This component renders project details for a selected user within the Users modal tab.
 * It attempts to read project details (project_id, project_name) from the selectedUser object when available.
 * If not present, it will fetch from the backend using the /api/users/{userId}/projects endpoint,
 * requiring tenant/organization scoping taken from auth context when available.
 *
 * Changes in this version:
 * - Adds request de-duplication and cancellation via api/users getUserProjects inflight map.
 * - Cancels stale in-flight request when user selection changes.
 * - Supports receiving pre-fetched project data via prop to avoid nested duplicate fetches.
 */
export default function ProjectDetails({ selectedUser, prefetchedProjects }) {
  const { organizationId: authOrgId } = useAuth?.() || {};
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState(null);

  const userId = useMemo(() => {
    if (!selectedUser) return null;
    return selectedUser._id || selectedUser.id || selectedUser.user_id || null;
  }, [selectedUser]);

  // Prefer projects provided from container
  const preloadedProjects = useMemo(() => {
    if (Array.isArray(prefetchedProjects) && prefetchedProjects.length > 0) {
      return prefetchedProjects;
    }
    if (!selectedUser) return null;
    // Try common shapes possibly embedded on user object
    if (Array.isArray(selectedUser.projects) && selectedUser.projects.length > 0) {
      return selectedUser.projects
        .map((p) => ({
          project_id: p.project_id || p.projectId || p.id || null,
          project_name: p.project_name || p.projectName || p.name || null,
          last_activity: p.last_activity || p.lastActivity || null,
        }))
        .filter((p) => p.project_id || p.project_name);
    }
    const single = {
      project_id:
        selectedUser.project_id ||
        selectedUser.projectId ||
        (selectedUser.project && (selectedUser.project.id || selectedUser.project.project_id)),
      project_name:
        selectedUser.project_name ||
        selectedUser.projectName ||
        (selectedUser.project && (selectedUser.project.name || selectedUser.project.project_name)),
    };
    if (single.project_id || single.project_name) {
      return [single];
    }
    return null;
  }, [prefetchedProjects, selectedUser]);

  // Track the last request params for targeted cancellation on unmount/change.
  const lastReqRef = useRef({ userId: null, params: null });

  useEffect(() => {
    const controller = new AbortController();

    async function fetchProjects() {
      if (!userId) {
        setProjects([]);
        return;
      }
      if (preloadedProjects) {
        setProjects(preloadedProjects);
        return;
      }

      setLoading(true);
      setError(null);
      const params = {
        organization_id:
          authOrgId ||
          selectedUser?.organization_id ||
          selectedUser?.tenant_id ||
          selectedUser?.tenantId,
      };

      try {
        lastReqRef.current = { userId, params };
        const res = await getUserProjects(userId, params, {
          signal: controller.signal,
          // Guard against overlapping identical requests
          cancelPrevious: true,
        });
        const list = Array.isArray(res?.projects) ? res.projects : [];
        setProjects(
          list.map((p) => ({
            project_id: p.project_id || p.projectId || p.id || null,
            project_name: p.project_name || p.projectName || p.name || null,
            last_activity: p.last_activity || p.lastActivity || null,
          }))
        );
      } catch (e) {
        if (e?.name === 'AbortError') return;
        setError(e?.message || 'Failed to load project details');
        setProjects([]);
      } finally {
        setLoading(false);
      }
    }

    fetchProjects();

    // Cleanup on param change/unmount: abort the specific in-flight request
    return () => {
      controller.abort();
      const { userId: uid, params } = lastReqRef.current || {};
      if (uid) cancelUserProjectsRequest(uid, params || {});
    };
    // Include only dependencies that change the identity of the request
  }, [userId, preloadedProjects, authOrgId, selectedUser?.organization_id, selectedUser?.tenant_id, selectedUser?.tenantId]);

  if (!selectedUser) {
    return (
      <div className="p-4 text-sm text-gray-600">
        No user selected.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 text-sm">
        Loading project details...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-red-600">
        {error}
      </div>
    );
  }

  if (!projects || projects.length === 0) {
    return (
      <div className="p-4 text-sm ">
        No project details available for this user.
      </div>
    );
  }

  return (
    <div className="p-4">
      <ul className="space-y-2">
        {projects.map((p, idx) => (
          <li
            key={`${p.project_id || 'unknown'}-${idx}`}
            className="rounded-md border border-gray-700 bg-gray-900 p-3 shadow-sm"
          >
            <div className="text-sm space-y-1">

              {/* Project Name */}
              <div className="font-medium text-white">
                <span className="font-semibold">Project Name:</span>
                <span className="font-mono ml-1"> {p.project_name || '—'}</span>

              </div>

              {/* Project ID */}
              <div className="text-white">
                <span className="font-semibold">Project ID:</span>
                <span className="font-mono ml-1">{p.project_id || '—'}</span>
              </div>

              {/* Last Activity */}
              {p.last_activity && (
                <div className="text-xs text-gray-300">
                  <span className="font-semibold">Last activity:</span>
                  <span className="ml-1">
                    {new Date(p.last_activity).toLocaleString()}
                  </span>
                </div>
              )}

            </div>
          </li>


        ))}
      </ul>
    </div>
  );
}

ProjectDetails.propTypes = {
  selectedUser: PropTypes.object,
  // PUBLIC_INTERFACE: allows avoiding re-fetch when parent fetched already
  prefetchedProjects: PropTypes.array,
};
