import { listUsers } from "./baseClient";

/**
 * Normalize a tenant-ish id from a user document using the requested precedence:
 * - tenant_id first, otherwise organization_id
 */
function extractTenantIdFromUser(user) {
  const id = user?.tenant_id ?? user?.tenantId ?? user?.organization_id ?? user?.organizationId ?? null;
  return id ? String(id) : null;
}

/**
 * Try to extract a human-readable tenant name from a user document.
 * Supports a few likely shapes:
 * - tenant_name
 * - organization.name / organization.tenant_name
 * - organization_name
 */
function extractTenantNameFromUser(user, fallbackId) {
  const name =
    user?.tenant_name ??
    user?.tenantName ??
    user?.organization?.name ??
    user?.organization?.tenant_name ??
    user?.organization_name ??
    user?.organizationName ??
    null;

  const trimmed = String(name || "").trim();
  return trimmed || String(fallbackId || "");
}

/**
 * PUBLIC_INTERFACE
 * deriveTenantsForDropdownFromUsers
 * Fetches users via the existing users endpoint and derives a de-duplicated list of
 * tenants usable in the Users Analytics tenant dropdown.
 *
 * Rules:
 * - Tenant identifier precedence: tenant_id if present; otherwise organization_id.
 * - Name best-effort: tenant_name, organization.name, organization_name; fallback to id.
 * - De-duplication by id.
 *
 * Notes:
 * - This function intentionally uses listUsers() (which is already used by the users table hook).
 * - listUsers() is scoped by organization_id in the current baseClient sanitization rules; in
 *   super-admin environments where /api/users can return multiple orgs, this will still work.
 *   In single-org environments, the dropdown will simply show one tenant.
 *
 * @param {Object} [options]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<Array<{id: string, name: string}>>}
 */
export async function deriveTenantsForDropdownFromUsers(options = {}) {
  const resp = await listUsers({}, { signal: options?.signal });

  const users = Array.isArray(resp?.items) ? resp.items : [];
  const byId = new Map();

  for (const u of users) {
    const id = extractTenantIdFromUser(u);
    if (!id) continue;

    const name = extractTenantNameFromUser(u, id);

    // De-dupe by id; prefer the first non-empty name encountered.
    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, { id, name });
    } else if (!existing.name && name) {
      byId.set(id, { id, name });
    }
  }

  return Array.from(byId.values()).sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

export default { deriveTenantsForDropdownFromUsers };
