# Users module - Projects API dedup

Summary of changes:
- Introduced hook hooks/useUserProjects.js to fetch /api/users/{id}/projects with:
  - Single request per unique change in { userId, organizationId, page, limit, from, to }
  - In-flight cancellation using AbortController
  - Simple memo cache to avoid duplicate network calls across re-renders
- UsersAnalyticsPanel.jsx:
  - Removed per-user parallel fetch loop calling /api/users/:id/projects
  - Charts now avoid triggering any projects endpoint calls; project details are fetched on demand in the modal.
- ProjectDetails.jsx:
  - Switched to useUserProjects hook
  - Keeps pagination controls; uses preloaded projects if present
- api/users.js:
  - getUserProjects now accepts optional axiosConfig for AbortSignal passthrough

Acceptance goals covered:
- At most one GET /api/users/:id/projects per unique pagination/filter change
- No parallel duplicate requests on initial mount or tab switches
- Charts/tables continue to render; project details load via single-source hook
- ETag behavior unchanged and base client /api prefix preserved
