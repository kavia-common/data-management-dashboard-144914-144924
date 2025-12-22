Overview KPI Tiles
- Data source: GET /api/dashboard/overview/metrics
- Tenant scope: Sends organization_id in query and x-organization-id header (works for T0000 and non-T0000)
- Hook: useOverviewKpis loads on mount, ensures single in-flight request, and aborts only on unmount
- Adapter shape: { label, value, delta? } (delta currently omitted)
- Debugging: console.debug logs on start/end with response size
- Styling: Ocean Professional accents with subtle gradient and surface background; no heavy overrides
