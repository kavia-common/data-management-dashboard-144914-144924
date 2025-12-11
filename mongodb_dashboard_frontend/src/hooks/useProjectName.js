import { useMemo } from 'react';

/**
 * PUBLIC_INTERFACE
 * useProjectName
 * Deprecated: This hook no longer performs any network requests.
 * It now provides a simple fallback that always returns null for projectName,
 * indicating that callers should render project_name if available from
 * /api/users/{userId}/projects, otherwise fallback to showing project_id.
 *
 * @param {string|number|null|undefined} projectId
 * @returns {{ projectName: string|null, loading: boolean, error: null }}
 */
export default function useProjectName(projectId) {
  // We keep a stable shape for compatibility, but do not fetch anything.
  // Callers should rely on provided project_name (if present) or fallback to project_id in UI.
  // projectId is accepted only to preserve signature; unused.
  // Using useMemo to keep referential stability across renders.
  return useMemo(
    () => ({
      projectName: null,
      loading: false,
      error: null,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [String(projectId ?? '')]
  );
}
