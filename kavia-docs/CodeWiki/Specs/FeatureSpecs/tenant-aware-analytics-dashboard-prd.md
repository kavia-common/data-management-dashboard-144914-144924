# Tenant-Aware Analytics Dashboard (React) — Product Requirements Document (PRD)

## Purpose and scope

This document describes the product requirements for the tenant-aware analytics dashboard frontend contained in `mongodb_dashboard_frontend/`. It is written for stakeholders and developers and is grounded in the current implementation in the repository.

The application is a React single-page dashboard that requires authentication and then scopes analytics views by an active tenant (also referred to as organization). The primary user-visible modules are Overview, Users, Session Tracking, Deployments (labeled “Project Details” in navigation), and a Costs module that is visible only for a super-admin tenant.

## Product overview

The dashboard’s core value is to provide authenticated users with analytics and operational visibility for a specific tenant. For users who belong to multiple tenants, the app prompts them to select which tenant to operate in. For users who belong to a single tenant, the app auto-selects that tenant to reduce friction.

The app is intended for desktop use only. Viewports narrower than 1024px are blocked with an overlay, preventing access to the application UI.

This product is frontend-only in this repository and depends on a remote backend API for authentication, tenant discovery/selection, and analytics data retrieval.

## Personas and roles

### Authenticated tenant user
A normal authenticated user who has access to one or more tenants. Their tenant scope is stored client-side and is used to scope API requests.

Evidence:
- Route access requires `AuthContext.isAuthenticated` via `ProtectedRoute`. See `mongodb_dashboard_frontend/src/components/common/ProtectedRoute.jsx`.
- Tenant scoping is managed via localStorage keys, such as `activeOrganization` and `activeTenant`. See `mongodb_dashboard_frontend/src/api/authTokenProvider.js` and `mongodb_dashboard_frontend/src/utils/tenantClient.js`.

### Super-admin tenant user (special tenant “T0000”)
A special user associated with tenant/organization id `T0000`. This role has additional product behavior:
- The Costs module is shown in the sidebar only when the active tenant id is `T0000`.

Evidence:
- Super-admin detection: `SUPER_ADMIN_ORG_ID = 'T0000'` and `isSuperAdmin(...)` in `mongodb_dashboard_frontend/src/utils/isSuperAdmin.js`.
- Sidebar conditional rendering: `showCostsModule` in `mongodb_dashboard_frontend/src/components/layout/Sidebar.jsx`.

## User journeys and functional requirements

### FR-1: Desktop-only access gate

The app must block use on non-desktop widths, showing a “Desktop Only Application” overlay.

Acceptance criteria:
1. If viewport width is less than 1024px, only the overlay is rendered.
2. If viewport width is 1024px or more, normal routing is available.

Evidence:
- `useIsBelowDesktopBreakpoint(1024)` and conditional rendering in `mongodb_dashboard_frontend/src/App.js`.

### FR-2: Authentication-gated routing

The dashboard routes must require authentication. Unauthenticated users must be redirected to the login page, preserving the originally requested path.

Acceptance criteria:
1. Visiting any protected route while unauthenticated redirects to `/login`.
2. The redirect includes route state `from` so the app can navigate back after login.

Evidence:
- `ProtectedRoute` checks `useAuth().isAuthenticated` and redirects with `state={{ from: location }}` in `mongodb_dashboard_frontend/src/components/common/ProtectedRoute.jsx`.
- Protected route wrapper is defined in `mongodb_dashboard_frontend/src/routes/AppRoutes.jsx` as `<Route element={<ProtectedRoute />}>...</Route>`.

### FR-3: Login with organization discovery and encrypted organization_id

The login experience must:
1. Allow the user to enter an email.
2. Fetch organizations associated with that email.
3. Allow selecting an organization.
4. Allow entering a password.
5. Authenticate using the selected organization and password.
6. Persist session token and any returned tenant identifiers and name in client state.

Evidence:
- Organization discovery flow in `mongodb_dashboard_frontend/src/pages/Login.js` calls `fetchUserOrganizationsByEmail(email)` from `mongodb_dashboard_frontend/src/api/authClient.js`.
- Login flow in `mongodb_dashboard_frontend/src/pages/Login.js` calls `loginWithOrgEmailPassword(...)`.
- Organization id is encrypted before sending login payload: `encryptTenantId(organizationId)` in `mongodb_dashboard_frontend/src/api/authClient.js`.
- Login persists auth via `AuthContext.login({ token, tenant_id, tenant_name })` in `mongodb_dashboard_frontend/src/pages/Login.js`.
- Token and tenant metadata storage behavior is implemented in `mongodb_dashboard_frontend/src/api/authTokenProvider.js` and `mongodb_dashboard_frontend/src/context/AuthContext.jsx`.

### FR-4: Tenant bootstrap and tenant selection

After authentication, the app must ensure an “active tenant” is selected before dashboard usage.

Acceptance criteria (as implemented):
1. If the user is already on `/tenant/select`, do not redirect (avoid loops).
2. If an active tenant exists and the current path is a “neutral landing” (`/` or `/dashboard`), redirect to `/dashboard/overview`.
3. If no active tenant exists, fetch authorized tenants via `GET /api/session/tenants`.
4. If zero tenants are returned, navigate to `/tenant/select` and show an informational state.
5. If exactly one tenant is returned, auto-select it via `POST /api/tenants/select` and then navigate to `/dashboard/overview`.
6. If multiple tenants exist, navigate to `/tenant/select`.

Evidence:
- Tenant bootstrap logic in `mongodb_dashboard_frontend/src/components/TenantBootstrap.jsx`:
  - Reads active tenant via `getActiveTenant()`.
  - Fetches tenants via `fetchSessionTenants()`.
  - Auto-selects via `selectTenant(...)`.
  - Navigates accordingly.
- Tenant selection page `mongodb_dashboard_frontend/src/pages/TenantSelection.jsx`:
  - Loads tenants using `fetchSessionTenants()`.
  - Selects a tenant via `selectTenant(...)`.
  - Redirects using `window.location.replace('/dashboard/overview')`.
- Tenant localStorage behavior in `mongodb_dashboard_frontend/src/utils/tenantClient.js` (`activeTenant` and `activeOrganization` mirroring).

Note: A `TenantBootstrapGate` component exists to mount bootstrap logic alongside an `Outlet`, but it is not wired into the active routing tree shown in `AppRoutes.jsx`.

Evidence:
- Gate component in `mongodb_dashboard_frontend/src/components/common/TenantBootstrapGate.jsx`.
- No usage in `mongodb_dashboard_frontend/src/routes/AppRoutes.jsx`.

### FR-5: Navigation and modules

The dashboard must provide navigation links to core modules:
- Overview
- Users
- Session Tracking
- Project Details (deployments route)
- Costs (super-admin only)

Acceptance criteria:
1. Sidebar is always visible (no collapse behavior).
2. Topbar shows tenant name when available.

Evidence:
- Layout composition in `mongodb_dashboard_frontend/src/components/layout/AppLayout.jsx` (Sidebar + Topbar).
- Sidebar links and conditional Costs display in `mongodb_dashboard_frontend/src/components/layout/Sidebar.jsx`.
- Tenant name rendering in top bar using auth hints and resolved org id in `mongodb_dashboard_frontend/src/components/layout/Topbar.jsx`.

### FR-6: Overview, Users, Sessions, Deployments, Costs routes

The application must provide routes and render the modules under `/dashboard/*`.

Acceptance criteria:
1. `/` redirects to `/dashboard/overview`.
2. `/dashboard` redirects to `/dashboard/overview`.
3. Module routes exist for overview, users, sessions, deployments, costs, and costs-underscore.

Evidence:
- Routing definitions in `mongodb_dashboard_frontend/src/routes/AppRoutes.jsx`:
  - `/dashboard/overview`, `/dashboard/users`, `/dashboard/sessions`, `/dashboard/deployments`, `/dashboard/costs`, `/dashboard/costs-underscore`.

### FR-7: Tenant scoping in API requests

API requests must be tenant-aware. The codebase uses a mix of mechanisms:
- For many “list” endpoints, scoping is done by adding `organization_id` query param from storage.
- For session-tracking list endpoint, scoping is done by adding `tenant_id` query param.
- For selected analytics endpoints, `x-organization-id` header scoping is preferred.

Acceptance criteria:
1. Requests include Authorization header when token exists.
2. Requests use tenant scoping based on active tenant selection.
3. Users analytics endpoint uses `x-organization-id` header scoping with explicit tenant override supported.

Evidence:
- Authorization header builder in `mongodb_dashboard_frontend/src/api/authTokenProvider.js` (`buildAuthHeaders`).
- `baseClient` request pipeline and scoping logic:
  - `ensureScopedQueryParams` and endpoint rules in `mongodb_dashboard_frontend/src/api/baseClient.js`.
- Header-based tenant scoping helper in `mongodb_dashboard_frontend/src/api/tenantScope.js` (`applyTenantScopeToRequest` and `resolveEffectiveTenantId`).
- Users analytics call uses header scoping in `listDashboardUsersAnalytics` in `mongodb_dashboard_frontend/src/api/baseClient.js`.

### FR-8: Super-admin behavior for viewing cross-tenant user details

When logged in as super-admin tenant `T0000`, the UI needs to determine effective tenant scope for certain per-user data fetches (to avoid scoping everything to T0000 when the selected user belongs to another tenant).

Acceptance criteria:
1. If active org is not super admin, use active org as effective tenant.
2. If active org is super admin, prefer the selected user’s tenant id when present.

Evidence:
- `resolveEffectiveTenantForUser(user, currentOrgId)` in `mongodb_dashboard_frontend/src/utils/resolveEffectiveTenantForUser.js`.

## Non-functional requirements (NFRs)

### NFR-1: Environment configurability of backend API target
The frontend must be able to connect to a backend API in different environments.

Evidence:
- `src/setupProxy.js` proxies `/api` and `/openapi.json` to a target computed from environment variables, supporting local dev and preview environments.
- `src/config/auth.js` defines `API_BASE_URL` for auth endpoints and defaults to `https://kaviaqa-worktool.cloud.kavia.ai`.
- `src/api/config.js` defines `apiBase` as a constant currently set to `https://kavia-dashboard-kavia-beta.cloud.kavia.ai/api`, and `getApiBase()` returns this value.

### NFR-2: Usability and performance
The app uses lazy loading and skeleton fallbacks for page content.

Evidence:
- `React.lazy` + `Suspense` fallbacks in `mongodb_dashboard_frontend/src/routes/AppRoutes.jsx`.

### NFR-3: Security expectations (frontend)
The frontend attaches bearer tokens to requests but does not persist secure session cookies itself (except in the tenant selection client which uses `credentials: 'include'` to carry cookies for tenant selection endpoints).

Evidence:
- `credentials: "omit"` is used in `mongodb_dashboard_frontend/src/api/baseClient.js`.
- `credentials: 'include'` is used for tenant selection endpoints in `mongodb_dashboard_frontend/src/utils/tenantClient.js`.
- Login requests use `credentials: "omit"` in `mongodb_dashboard_frontend/src/api/authClient.js`.

## Out of scope (not implemented here)

1. Backend authorization rules, data aggregation logic, and storage are not part of this repository.
2. A complete in-app UI for toggling “All tenants” mode is not wired into layout in the files reviewed, even though an `AllTenantsIndicator` component exists.

Evidence:
- `AllTenantsIndicator` exists at `mongodb_dashboard_frontend/src/components/AllTenantsIndicator.jsx`, but it is not imported in `Topbar.jsx` or `Sidebar.jsx` in the code read.
- `auth/organizations.js` depends on `../lib/httpClient`, which was not located or verified in the current reads; therefore, this capability is not considered complete in this PRD.

## Traceability appendix (key files)

- Routing: `mongodb_dashboard_frontend/src/routes/AppRoutes.jsx`
- Desktop-only gate: `mongodb_dashboard_frontend/src/App.js`
- Auth context: `mongodb_dashboard_frontend/src/context/AuthContext.jsx`
- Token/org storage: `mongodb_dashboard_frontend/src/api/authTokenProvider.js`
- Login page: `mongodb_dashboard_frontend/src/pages/Login.js`
- Organization discovery + login API: `mongodb_dashboard_frontend/src/api/authClient.js`, `mongodb_dashboard_frontend/src/api/urlOverrides.js`
- Tenant bootstrap + selection: `mongodb_dashboard_frontend/src/components/TenantBootstrap.jsx`, `mongodb_dashboard_frontend/src/pages/TenantSelection.jsx`, `mongodb_dashboard_frontend/src/utils/tenantClient.js`
- API client/scoping: `mongodb_dashboard_frontend/src/api/baseClient.js`, `mongodb_dashboard_frontend/src/api/tenantScope.js`
- Layout/navigation: `mongodb_dashboard_frontend/src/components/layout/AppLayout.jsx`, `mongodb_dashboard_frontend/src/components/layout/Sidebar.jsx`, `mongodb_dashboard_frontend/src/components/layout/Topbar.jsx`
- Super-admin detection: `mongodb_dashboard_frontend/src/utils/isSuperAdmin.js`
- Super-admin effective tenant resolution: `mongodb_dashboard_frontend/src/utils/resolveEffectiveTenantForUser.js`
