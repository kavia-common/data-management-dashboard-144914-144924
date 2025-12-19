# useSessionTracking

PUBLIC_INTERFACE
Consolidated, paginated data provider for GET /api/session-tracking.

Usage:
- Accepts { page, limit, tenantId, q, sort, immediate }
- Returns { items, total, loading, error, meta, refetch, setPage, setLimit, setQuery, setSort }

Notes:
- tenantId is optional; when omitted, tenant scoping is enforced by baseClient via auth/session.
- q is debounced internally (250ms).
- sort follows backend convention: "field" for asc, "-field" for desc.
- Only one API call is performed per unique {page, limit, tenantId, q, sort} context.
```js
import { useSessionTracking } from '../hooks';

const { items, total, loading, error, setPage, setLimit, setQuery, setSort } =
  useSessionTracking({ page: 1, limit: 10 });
```
