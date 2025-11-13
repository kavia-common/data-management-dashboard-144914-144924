import { getTenantHeaderName } from '../utils/tenantClient';

/**
 * PUBLIC_INTERFACE
 * Apply tenant header to request headers if tenantId is provided.
 */
export function withTenantHeaders(headers = {}, tenantId) {
  const name = getTenantHeaderName?.() || 'x-organization-id';
  if (tenantId) {
    return { ...headers, [name]: tenantId };
  }
  return headers;
}

export default { withTenantHeaders };
