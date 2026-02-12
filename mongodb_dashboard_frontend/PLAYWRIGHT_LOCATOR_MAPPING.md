# Playwright Locator Mapping (Dashboard Frontend)

## Purpose

This document captures stable, recommended locator strategies for Playwright end-to-end tests targeting the dashboard frontend in `mongodb_dashboard_frontend`. It is intended to reduce brittleness by preferring accessibility-first locators (`getByRole`, `getByLabel`) and explicit test IDs (`data-testid`) when available.

The mappings below are derived from the current React components and pages in this repository. When a stable attribute does not exist in code, the mapping recommends the most reliable available selector and notes any gaps.

## General locator rules for this app

Tests should prefer the following order, from most stable to least stable:

1. `page.getByTestId(...)` when `data-testid` exists.
2. `page.getByRole(..., { name: ... })` for interactive elements and landmarks.
3. `page.getByLabel(...)` for form fields using `aria-label` or `<label>` associations.
4. `page.getByText(...)` only when the text is very unlikely to change.
5. CSS selectors (classes, DOM structure) only as a last resort.

This frontend already includes some accessibility attributes such as `aria-label` and `role`, which makes role/label selectors a good default.

## Base URL and routes under test

The route tree is defined in `src/routes/AppRoutes.jsx`.

Public route:

- `/login`

Protected routes (guarded by `ProtectedRoute` and wrapped in `AppLayout`):

- `/dashboard/overview`
- `/dashboard/users`
- `/dashboard/sessions`
- `/dashboard/deployments`
- `/dashboard/costs` (conditionally shown in sidebar for super-admin)
- `/dashboard/costs-underscore`

## Locator map by screen / area

### Login page (`/login`)

The login UI is implemented in `src/pages/Login.js` (this is the route used by `AppRoutes.jsx`). It includes accessible labels for inputs and an explicit `role="alert"` for the error banner.

#### Page-level container

The outer container uses a CSS class, which is less ideal than roles, but can be used for quick sanity checks.

- Recommended: rely on unique elements (logo alt text, heading) rather than the container class.
- Fallback:
  - `page.locator('.auth-screen')`

#### Logo and headings

- Logo image:
  - `page.getByRole('img', { name: 'Company logo' })`
- Primary heading “Sign in”:
  - `page.getByRole('heading', { name: 'Sign in' })`

#### Error banner (invalid credentials, missing fields, etc.)

- Error banner:
  - `page.getByRole('alert')`

Because the error message content can vary, it is generally safer to assert the alert exists and optionally assert the message contains expected text.

#### Email input

In `Login.js`, the email `Input` has `aria-label="Email address"`.

- Email input:
  - `page.getByLabel('Email address')`

#### Find organizations button

This button has `aria-label="Find organizations for this email"` and visible text “Find Organizations”.

- Find organizations:
  - `page.getByRole('button', { name: 'Find organizations for this email' })`
- Alternative:
  - `page.getByRole('button', { name: 'Find Organizations' })`

#### Organization dropdown

The `<select>` uses `aria-label="Organization"`.

- Organization select:
  - `page.getByLabel('Organization')`

#### Password input

The password `Input` has `aria-label="Password"`.

- Password input:
  - `page.getByLabel('Password')`

#### Login button

The login action is a `Button` with visible text `Login` (while loading it becomes `Signing in…`).

- Login:
  - `page.getByRole('button', { name: /^Login$/ })`
- Loading state assertion:
  - `page.getByRole('button', { name: /Signing in/ })`

### Tenant selection page (if used)

A tenant selection screen exists at `src/pages/TenantSelection.jsx`. It is not currently wired into `AppRoutes.jsx`, but may be used by other flows (for example via `TenantBootstrap` or external redirects). It renders a heading, a list of tenants as buttons, and a minimal error paragraph.

#### Heading

- Heading:
  - `page.getByRole('heading', { name: 'Select a tenant' })`

#### Loading text

- Loading indicator:
  - `page.getByText('Loading tenants…')`

#### Tenant buttons

Tenants are rendered as `<button>` with the visible tenant name.

- Select tenant by name:
  - `page.getByRole('button', { name: '<TENANT_NAME>' })`

If tenant names are dynamic and not stable across environments, tests should drive selection by a fixture tenant or by API mocking. If the UI needs stable selection independent of name, consider adding `data-testid` to the tenant button in the app code.

#### Error text

- Error message (rendered as a `<p>` with inline red color):
  - `page.getByText(/.+/)` within the tenant selection container, or assert that an error is visible by checking for a known message substring.

Because the error paragraph has no role or test id, this is relatively brittle.

### App layout (protected dashboard)

Protected pages are wrapped with `AppLayout` (`src/components/layout/AppLayout.jsx`) which includes the sidebar (`Sidebar.jsx`) and topbar (`Topbar.jsx`).

#### Topbar (banner)

Topbar uses `<header ... role="banner">`.

- Topbar banner:
  - `page.getByRole('banner')`

The brand element also uses an `aria-label` derived from the tenant name, which can vary. Prefer the banner role for stable targeting.

- Brand logo:
  - `page.getByRole('banner').getByRole('img', { name: 'Company logo' })`

#### Sidebar navigation

Sidebar is `<aside id="app-sidebar" ... role="navigation" aria-label="Primary navigation">`.

- Sidebar navigation landmark:
  - `page.getByRole('navigation', { name: 'Primary navigation' })`
- Sidebar by id:
  - `page.locator('#app-sidebar')`

Within the sidebar, the internal `<nav aria-label="Dashboard sections">` contains links.

- Dashboard sections nav:
  - `page.getByRole('navigation', { name: 'Dashboard sections' })`

#### Sidebar links (NavLink)

The sidebar’s `NavLink` entries have visible text labels. Prefer `getByRole('link', { name: ... })`.

- Overview:
  - `page.getByRole('link', { name: 'Overview' })`
- Users:
  - `page.getByRole('link', { name: 'Users' })`
- Session Tracking:
  - `page.getByRole('link', { name: 'Session Tracking' })`
- Project Details (deployments):
  - `page.getByRole('link', { name: 'Project Details' })`
- Costs (only for super-admin):
  - `page.getByRole('link', { name: 'Costs' })`

Because Costs is conditional, tests should either:
1) run in a super-admin tenant and assert the link exists, or
2) assert the link is absent for non-super-admin tenants.

#### Logout button

Logout button includes both `aria-label="Log out"` and `data-testid="logout-button"`.

- Logout by test id (most stable):
  - `page.getByTestId('logout-button')`
- Logout by role + name:
  - `page.getByRole('button', { name: 'Log out' })`

After clicking, the sidebar code navigates to `/login`, so tests can assert on the login heading or URL.

### Protected-route behavior

`ProtectedRoute` exists in `src/components/common/ProtectedRoute.jsx` and `src/components/ProtectedRoute.jsx` (two variants). `AppRoutes.jsx` imports the one under `components/common`.

This typically means that unauthenticated users are redirected to `/login`. For Playwright tests, a stable assertion is:

- `await expect(page).toHaveURL(/\/login$/);`
- `await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();`

## Practical Playwright examples using these locators

### Login flow (happy path)

```ts
import { test, expect } from '@playwright/test';

test('user can log in and reach overview', async ({ page }) => {
  await page.goto('/login');

  await page.getByLabel('Email address').fill('user@example.com');
  await page.getByRole('button', { name: 'Find organizations for this email' }).click();

  // Select org; name will vary by environment.
  await page.getByLabel('Organization').selectOption({ index: 1 });

  await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { name: /^Login$/ }).click();

  await expect(page).toHaveURL(/\/dashboard\/overview$/);
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
});
```

### Sidebar navigation

```ts
test('can navigate to Users from sidebar', async ({ page }) => {
  // Assume already authenticated via storageState or prior login.
  await page.goto('/dashboard/overview');

  await page.getByRole('link', { name: 'Users' }).click();
  await expect(page).toHaveURL(/\/dashboard\/users$/);
});
```

### Logout

```ts
test('logout returns to login page', async ({ page }) => {
  await page.goto('/dashboard/overview');

  await page.getByTestId('logout-button').click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});
```

## Gaps and recommended app-side improvements (optional)

Some areas would become significantly easier to test if the application added explicit `data-testid` attributes:

1. Tenant selection list items in `src/pages/TenantSelection.jsx` could add `data-testid` such as `tenant-select-${id}` so tests can select by tenant id rather than visible name.
2. Consider adding `data-testid` to key page headings or root containers for each dashboard page to allow unambiguous “page loaded” assertions after navigation.

These are not required to write tests, but they make selectors more stable across UI text or styling changes.
