Centralized Auth & API Client

Overview
- A shared Axios client (src/api/httpClient.js) attaches Authorization: Bearer <token> to every non-public API request.
- Public endpoints are exempt: /health, /api-docs, /swagger, /api/auth/health, /api/auth/login, /api/auth/signup, /api/auth/reset-password.
- On 401/403 responses, the client clears auth and redirects to /login with ?next=<current>.

Storage Keys
- auth.token: JWT access token
- auth.tenantId: active tenant id
- auth.user: reserved for future user info

Helpers
- src/utils/auth.js exports:
  - getAuthToken(), setAuthToken(token), clearAuth()
  - getTenantId(), setTenantId(tenantId)

Login Flow
- src/api/authClient.js exports loginAndStore(payload) and signupAndStore(payload)
- After successful login/signup, token and tenant_id from response are saved.

Migration Notes
- All API modules now import the centralized client via:
  import httpClient from '../api/httpClient';
  or re-exported as `api` from src/api/baseClient.js.

Verification
- Inspect network requests in the browser DevTools; non-public endpoints include Authorization header.
- Public endpoints remain unauthenticated.
