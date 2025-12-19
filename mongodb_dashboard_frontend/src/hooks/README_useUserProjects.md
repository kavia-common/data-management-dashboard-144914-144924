# useUserProjects

- Centralized single-source hook for fetching a user's projects with pagination and filters.
- Internally loads the full list once for a given (userId, organization_id, from, to) tuple and slices locally for pagination. This guarantees components do not trigger multiple network calls when page/pageSize changes.
- Usage:

```js
import useUserProjects from "../hooks/useUserProjects";

function UserProjectsTable({ userId }) {
  const { projects, total, page, pageSize, loading, error, setPage, setPageSize } =
    useUserProjects(userId, { page: 1, pageSize: 10, from, to });

  // render...
}
```

- Request params sent: organization_id, from, to (ISO). Pagination is applied client-side unless backend pagination is implemented later.
