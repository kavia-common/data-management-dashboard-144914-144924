# MongoDB Dashboard Frontend (React)

Modern, modular React dashboard styled with the "Ocean Professional" theme to manage data via an Express.js API.

## Dev server stability and low-memory mode

To reduce memory usage and prevent OOM kills in constrained environments:
- Default npm start uses a low memory cap and disables source maps:
  - NODE_OPTIONS=--max-old-space-size=256
  - GENERATE_SOURCEMAP=false (unless REACT_APP_ENABLE_SOURCE_MAPS=true)
- To re-enable source maps for deep debugging:
  - npm run start:smaps (uses 512MB cap and source maps), or
  - export REACT_APP_ENABLE_SOURCE_MAPS=true then npm start.

We also include an HMR-safe guard inside src/setupProxy.js to avoid duplicate proxy middleware registration, which helps prevent memory bloat and accidental multiple stacks.

Authorization headers are enforced centrally in the request client, ensuring /dashboard/users and related API calls include Authorization: Bearer <token> when available. For demo/unauthenticated scenarios, an x-organization-id header can be forwarded via localStorage or request options.

## Highlights

- Collections: Users, Session Tracking, App Deployments — CRUD UIs with modals and data tables.
- Charts: KPI area chart for overview/trends.
- Theming: Blue primary and amber accents, subtle gradients, rounded surfaces.
- API Integration: Request client with header injection and base URL helpers.
- Structure: Clean separation of pages, components, routes, and API helpers.

## Quickstart

1) Install dependencies
- npm install

2) Configure environment
- Copy .env.example to .env and set your variables (see .env.example).

3) Run the app
- npm start

App will run at http://localhost:3000 or the environment preview URL.

### Verify backend connectivity
- In development, the app proxies /api and /openapi.json to the backend target resolved from REACT_APP_API_BASE_URL or REACT_APP_BACKEND_PORT (default 3001).
- Ensure the backend is reachable under the configured origin.

### Authorization headers
- The request client attaches Authorization from authTokenProvider.buildAuthHeaders().
- For demo mode or when JWT is not present, you can set localStorage.setItem('x-organization-id', 'org_123') to forward a tenant header for endpoints that allow it.

## Proxy and HTTPS

In secure preview environments (https), mixed-content (http API) is blocked by browsers. The dev proxy addresses this by forwarding /api to the backend. If you set an https REACT_APP_API_BASE_URL, ensure the backend is also https to avoid mixed content.

## Environment Variables

- REACT_APP_ENABLE_SOURCE_MAPS=false by default to reduce memory usage.
- Common variables:
  - REACT_APP_API_BASE_URL
  - REACT_APP_API_URL
  - REACT_APP_BACKEND_PORT (default 3001)
  - REACT_APP_LOG_LEVEL
  - REACT_APP_WS_URL
  - REACT_APP_FRONTEND_URL

## Testing

- CRA testing setup is included; extend tests in src/.
