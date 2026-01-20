# Data Management Dashboard

This repository contains the **MongoDB Dashboard Frontend** (React) located in `mongodb_dashboard_frontend/`.

## Prerequisites

- Node.js 18+ (recommended)
- npm 9+ (or equivalent)

## Local Development (Frontend)

The frontend dev server runs on **port 3000**.

### 1) Install dependencies

```bash
cd mongodb_dashboard_frontend
npm install
```

### 2) Configure environment variables (`.env`)

This project uses environment variables to configure how the frontend connects to the backend API.

1. Create a local `.env` file (do **not** commit it):

```bash
cp .env.example .env
```

2. Set/verify the variables in `.env`.

#### Common/expected variables (from this container)

The following variables may exist in this container’s `.env`:

- `VITE_API_BASE`
- `VITE_BACKEND_URL`
- `VITE_FRONTEND_URL`
- `VITE_WS_URL`
- `VITE_NODE_ENV`
- `VITE_NEXT_TELEMETRY_DISABLED`
- `VITE_ENABLE_SOURCE_MAPS`
- `VITE_PORT`
- `VITE_TRUST_PROXY`
- `VITE_LOG_LEVEL`
- `VITE_HEALTHCHECK_PATH`
- `VITE_FEATURE_FLAGS`
- `VITE_EXPERIMENTS_ENABLED`

> Note: This frontend is implemented with Create React App (`react-scripts`). In CRA, environment variables used by the browser typically must be prefixed with `REACT_APP_`.  
> Some documentation in `mongodb_dashboard_frontend/README.md` references variables like `REACT_APP_API_BASE_URL`. If your current code expects `REACT_APP_*` variables, prefer those.

#### Backend URL / API base

At minimum, you must ensure the frontend knows where the backend API is running.

Typical local examples:

- Backend running locally on port 3001:
  - `REACT_APP_API_BASE_URL=http://localhost:3001`
  - `REACT_APP_API_PREFIX=/api` (optional; defaults to `/api` in many setups)

If you are using the dev proxy (see “Proxy notes” below), you may be able to leave the absolute backend URL unset and let the frontend call `/api/...` relative to the frontend origin.

### 3) Start the app

```bash
npm start
```

Then open:

- http://localhost:3000

## Port Information

- **Frontend**: http://localhost:3000
- **Backend** (commonly expected by the frontend): http://localhost:3001

## Proxy notes (development)

This project includes a development proxy (`mongodb_dashboard_frontend/src/setupProxy.js`) for forwarding frontend `/api` requests to a backend during local development.

In many setups:
- If you do **not** set an absolute API base URL, the app can call `/api/...` and the dev server proxy forwards it to the backend.
- If you set an absolute API base URL in an HTTPS preview environment, make sure the backend is reachable over HTTPS too (to avoid mixed-content browser blocking).

## Troubleshooting

### App starts but API calls fail (“Network Error”)

- Confirm your backend is running and reachable at the configured URL (open it in the browser).
- Confirm CORS is allowed by the backend for `http://localhost:3000`.
- Confirm you are using the correct protocol (http vs https) and correct backend port.

## More documentation

- Frontend details: `mongodb_dashboard_frontend/README.md`
- Auth notes (if applicable): `mongodb_dashboard_frontend/README_AUTH.md`
- Backend notes (repo docs): `kavia-docs/README_BACKEND.md`
