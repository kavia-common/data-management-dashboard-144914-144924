# MongoDB Dashboard Frontend (React)

## Project overview

This repository contains the frontend web application for the Data Management Dashboard. It is a React application (Create React App) that provides dashboard pages, charts, tables, and modals for working with backend data such as users, session tracking, deployments, and cost/analytics views.

The frontend is designed to communicate with the backend API (typically running on port `3001`) via a configurable API base URL and/or a development proxy.

## Tech stack and prerequisites

This project is implemented in JavaScript with React and Create React App.

Primary libraries and tools:

- React 18
- react-scripts (Create React App)
- react-router-dom (routing)
- Axios (HTTP)
- Recharts (charts)
- Jest and React Testing Library (testing)

Prerequisites:

- Node.js and npm
- A running backend API instance (local or deployed) that matches the expected routes

## Getting started

### 1) Setup and installation

From this repository root:

```bash
cd mongodb_dashboard_frontend
npm install
```

### 2) Environment variables

Create a `.env` file in `mongodb_dashboard_frontend/`.

The application reads environment variables prefixed with `REACT_APP_`. Common variables in this repo include:

- `REACT_APP_API_BASE_URL`  
  The backend origin, for example:
  - Local: `http://localhost:3001`
  - Deployed: `https://your-backend-host:3001`

- `REACT_APP_API_PREFIX`  
  API prefix used by the backend (default is typically `/api`).

Notes:

- Some code paths support `REACT_APP_API_URL` as an alternate name for the base URL. If both are set, `REACT_APP_API_URL` may take precedence in the client implementation.
- If `REACT_APP_API_BASE_URL` is not set, the frontend can rely on a relative `/api` base path and let the CRA dev server proxy requests (see “Proxy and HTTPS” below).

TODO: Add or confirm a `.env.example` file for contributors to copy.

### 3) Run locally

From `mongodb_dashboard_frontend/`:

```bash
npm start
```

By default, CRA serves the app on `http://localhost:3000`.

### 4) Verify backend connectivity

A common local configuration is:

- Backend: `http://localhost:3001`
- Frontend: `http://localhost:3000`

Make sure your `.env` points the frontend to the backend. If you are using `REACT_APP_API_BASE_URL`, you typically want:

- `REACT_APP_API_BASE_URL=http://localhost:3001`
- `REACT_APP_API_PREFIX=/api`

## Scripts / commands

All commands below are run from `mongodb_dashboard_frontend/`:

- `npm start`  
  Starts the development server.

- `npm run dev`  
  Alias for `npm start` (runs `react-scripts start`).

- `npm run build`  
  Produces a production build in `build/`.

- `npm test`  
  Runs tests (CRA interactive runner).

- `npm run eject`  
  Ejects CRA configuration (irreversible).

## Testing instructions

This repo uses Create React App’s Jest setup with React Testing Library.

From `mongodb_dashboard_frontend/`:

```bash
CI=true npm test
```

Using `CI=true` is recommended for non-interactive environments (CI pipelines) so the test command does not wait for input.

## Build and deployment

### Build

From `mongodb_dashboard_frontend/`:

```bash
npm run build
```

This generates a static bundle in `mongodb_dashboard_frontend/build/`.

### Deployment

TODO: Document the target hosting platform (S3/CloudFront, Vercel, Netlify, Nginx, etc.) once known.

At minimum, any static hosting setup must ensure:

- SPA routing is supported (unknown paths should serve `index.html`)
- The backend API is reachable from the browser (CORS and TLS considerations)
- Environment variables are set appropriately for the deployment environment

## Proxy and HTTPS

This project includes `src/setupProxy.js` (CRA proxy middleware). In development, using a proxy can avoid mixed-content and CORS problems by keeping API calls relative to the frontend origin.

Typical behavior:

- If `REACT_APP_API_BASE_URL` is not set, the client can use a relative base like `/api`, and the CRA dev server proxies `/api` to the backend.
- If you do set `REACT_APP_API_BASE_URL` in an HTTPS environment, ensure the backend is also available over HTTPS, otherwise the browser may block requests due to mixed content.

TODO: Confirm the intended workflow (explicit API base URL vs. proxy-first) for your team’s dev environment.

## Project structure

Key directories:

- `mongodb_dashboard_frontend/public/`  
  CRA public assets and `index.html`.

- `mongodb_dashboard_frontend/src/`  
  Application source code.
  - `App.js` / `App.jsx` and `index.js` bootstrapping
  - `routes/` for route configuration
  - `pages/` for page-level screens (dashboard sections)
  - `components/` for reusable UI components (tables, charts, layout)
  - `api/` for API clients and endpoint wrappers
  - `context/` for React contexts (auth/data)
  - `utils/` for helper utilities (formatting, tenant helpers, etc.)
  - `hooks/` for custom hooks

## Contributing

Contributions are welcome.

Before opening a PR:

1. Run `CI=true npm test` from `mongodb_dashboard_frontend/`.
2. Ensure `npm run build` succeeds.
3. Keep API-related changes consistent with backend routes and response shapes.

TODO: Add a more detailed contribution guide if you expect external contributors.

## License

TODO: Add the project license. If unknown, keep this placeholder until confirmed.

## Contact / maintainers

TODO: Add maintainers and a preferred contact method.

If you do not know who owns this repository, start by contacting the team responsible for the Data Management Dashboard frontend.
