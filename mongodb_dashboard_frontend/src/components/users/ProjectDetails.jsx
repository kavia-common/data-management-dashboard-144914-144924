import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { getUserProjects } from '../../api/users';
import { useAuth } from '../../context/AuthContext';

/**
 * PUBLIC_INTERFACE
 * ProjectDetails
 * This component renders project details for a selected user within the Users modal tab.
 * It attempts to read project details (project_id, project_name) from the selectedUser object when available.
 * If not present, it will fetch from the backend using the /api/users/{userId}/projects endpoint,
 * requiring tenant/organization scoping taken from auth context when available.
 */
export default function ProjectDetails({ selectedUser }) {
  const { organizationId: authOrgId } = useAuth?.() || {};
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState(null);

  const userId = useMemo(() => {
    if (!selectedUser) return null;
    return selectedUser._id || selectedUser.id || selectedUser.user_id || null;
  }, [selectedUser]);

  const preloadedProjects = useMemo(() => {
    if (!selectedUser) return null;
    // Try common shapes possibly embedded on user object
    // Accept: selectedUser.projects (array), or single project fields at root
    if (Array.isArray(selectedUser.projects) && selectedUser.projects.length > 0) {
      // Normalize map to { project_id, project_name }
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
  }, [selectedUser]);

  useEffect(() => {
    let cancelled = false;
    async function fetchProjects() {
      if (!userId) {
        setProjects([]);
        return;
      }
      // Use preloaded when available
      if (preloadedProjects) {
        setProjects(preloadedProjects);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        // The backend requires organization_id/tenant_id
        // Prefer organization from auth context when present
        const query = {
          organization_id: authOrgId || selectedUser?.organization_id || selectedUser?.tenant_id || selectedUser?.tenantId,
        };
        // If organization is unavailable, we still attempt (backend may enforce). Gracefully handle 400.
        const res = await getUserProjects(userId, query);
        if (!cancelled) {
          const list = Array.isArray(res?.projects) ? res.projects : [];
          setProjects(
            list.map((p) => ({
              project_id: p.project_id || p.projectId || p.id || null,
              project_name: p.project_name || p.projectName || p.name || null,
              last_activity: p.last_activity || p.lastActivity || null,
            }))
          );
        }
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || 'Failed to load project details');
          setProjects([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchProjects();
    return () => {
      cancelled = true;
    };
  }, [userId, preloadedProjects, authOrgId, selectedUser]);

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
                <span className="font-mono ml-1">
                  {p.project_name || (p.project_id ? `Project ${String(p.project_id).slice(0, 6)}` : '—')}
                </span>
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
};
