export function tenantHeaders(organizationId) {
  if (!organizationId) return {};
  return { 'x-organization-id': organizationId };
}

// PUBLIC_INTERFACE
// Append tenant header to provided headers object, returning a new object.
// Keeps compatibility with legacy code that imported withTenantHeaders from './util'.
export function withTenantHeaders(headers = {}, organizationId) {
  const base = headers && typeof headers === 'object' ? headers : {};
  return { ...base, ...tenantHeaders(organizationId) };
}

// PUBLIC_INTERFACE
// Convenience re-export for compatibility; primary source is api/config.js
export { getApiBaseUrl } from './config';
