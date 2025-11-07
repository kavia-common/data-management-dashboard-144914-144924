import httpClient, { storeAuthFromResponse } from './httpClient';
import { encryptTenantId } from '../utils/hash';
import { getApiBaseUrl } from './util';

// PUBLIC_INTERFACE
export async function fetchUserOrganizationsByEmail(email) {
  const url = `${getApiBaseUrl().replace(/\/api$/, '')}/api/auth/user-organizations`;
  const res = await httpClient.get(url, { params: { email } });
  return res.data;
}

// PUBLIC_INTERFACE
export async function loginWithOrgEmailPassword({ organizationId, email, password }) {
  if (!organizationId) throw new Error('organizationId is required');
  if (!email) throw new Error('email is required');
  if (!password) throw new Error('password is required');

  const encryptedOrgId = encryptTenantId(organizationId);
  const res = await httpClient.post('/api/auth/login', {
    organization_id: encryptedOrgId,
    email,
    password,
  });
  const data = res?.data || {};
  storeAuthFromResponse(data);
  const token = data.token || data.access_token || null;
  return { token, payload: data };
}

export default httpClient;