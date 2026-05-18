/**
 * Utilities for resolving and rendering user display names across modules.
 *
 * Strategy:
 * 1) Prefer explicit name fields embedded in a record (user_name, userName, user.displayName, etc.)
 * 2) Fall back to known user identifier (user_id/userId/ownerId/...) and resolve via users list
 * 3) If still unknown, fall back to email, then a short form of the userId, then "Unknown User"
 */

import { listUsers } from "../api";

/**
 * PUBLIC_INTERFACE
 * getUserIdentifierFromRecord
 * Extracts a user identifier from an arbitrary record shape (cost record, session record, etc.).
 *
 * Handles common variants: user_id, userId, ownerId, user, user._id, user.id.
 *
 * @param {any} record
 * @returns {string|null}
 */
export function getUserIdentifierFromRecord(record) {
  if (!record || typeof record !== "object") return null;

  const direct =
    record.user_id ??
    record.userId ??
    record.ownerId ??
    record.owner_id ??
    record.userID ??
    record.userid ??
    record.user;

  if (typeof direct === "string" && direct.trim()) return direct.trim();
  if (typeof direct === "number") return String(direct);

  // Nested object variants
  const nested = record.user;
  if (nested && typeof nested === "object") {
    const nid = nested._id ?? nested.id ?? nested.user_id ?? nested.userId;
    if (typeof nid === "string" && nid.trim()) return nid.trim();
    if (typeof nid === "number") return String(nid);
  }

  return null;
}

/**
 * PUBLIC_INTERFACE
 * getEmbeddedUserDisplayName
 * Attempts to extract a displayable user name from the record itself (no API calls).
 *
 * @param {any} record
 * @returns {string|null}
 */
export function getEmbeddedUserDisplayName(record) {
  if (!record || typeof record !== "object") return null;

  const candidates = [
    record.user_name,
    record.userName,
    record.user_display_name,
    record.userDisplayName,
    record.owner_name,
    record.ownerName,
    record.name,
  ];

  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }

  // Nested user object
  const u = record.user;
  if (u && typeof u === "object") {
    const nestedCandidates = [u.name, u.user_name, u.displayName, u.full_name, u.fullName];
    for (const c of nestedCandidates) {
      if (typeof c === "string" && c.trim()) return c.trim();
    }
  }

  return null;
}

/**
 * PUBLIC_INTERFACE
 * getEmbeddedUserEmail
 * Extract a plausible user email from the record for fallback display.
 *
 * @param {any} record
 * @returns {string|null}
 */
export function getEmbeddedUserEmail(record) {
  if (!record || typeof record !== "object") return null;

  const candidates = [record.email, record.user_email, record.userEmail, record.owner_email, record.ownerEmail];

  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }

  const u = record.user;
  if (u && typeof u === "object") {
    const nestedCandidates = [u.email, u.user_email];
    for (const c of nestedCandidates) {
      if (typeof c === "string" && c.trim()) return c.trim();
    }
  }

  return null;
}

/**
 * PUBLIC_INTERFACE
 * shortUserId
 * Creates a compact user identifier for UI fallback rendering.
 *
 * @param {string|null|undefined} userId
 * @param {number} [keep]
 * @returns {string|null}
 */
export function shortUserId(userId, keep = 6) {
  if (!userId) return null;
  const s = String(userId);
  if (s.length <= keep * 2 + 1) return s;
  return `${s.slice(0, keep)}…${s.slice(-keep)}`;
}

/**
 * Build an ID->name map from a list of user docs (best-effort).
 * @param {any[]} users
 * @returns {Record<string,string>}
 */
function buildUserIdMapFromUsers(users) {
  const out = {};
  (Array.isArray(users) ? users : []).forEach((u) => {
    if (!u || typeof u !== "object") return;
    const id = u._id ?? u.id ?? u.user_id ?? u.userId;
    if (!id) return;

    const name =
      (typeof u.name === "string" && u.name.trim() ? u.name.trim() : null) ||
      (typeof u.user_name === "string" && u.user_name.trim() ? u.user_name.trim() : null) ||
      (typeof u.displayName === "string" && u.displayName.trim() ? u.displayName.trim() : null) ||
      (typeof u.full_name === "string" && u.full_name.trim() ? u.full_name.trim() : null) ||
      (typeof u.fullName === "string" && u.fullName.trim() ? u.fullName.trim() : null) ||
      (typeof u.email === "string" && u.email.trim() ? u.email.trim() : null);

    if (!name) return;
    out[String(id)] = name;
  });
  return out;
}

/**
 * PUBLIC_INTERFACE
 * resolveUserDisplayNameForRecord
 * Resolve a display name for a record using:
 * - Embedded name fields
 * - Provided id->name map
 * - Email fallback
 * - Short userId fallback
 * - Final fallback: "Unknown User"
 *
 * @param {any} record
 * @param {Record<string,string>} [idToName]
 * @returns {string}
 */
export function resolveUserDisplayNameForRecord(record, idToName = {}) {
  const embedded = getEmbeddedUserDisplayName(record);
  if (embedded) return embedded;

  const userId = getUserIdentifierFromRecord(record);
  if (userId && idToName && typeof idToName === "object" && idToName[userId]) return idToName[userId];

  const email = getEmbeddedUserEmail(record);
  if (email) return email;

  const short = shortUserId(userId);
  if (short) return short;

  return "Unknown User";
}

/**
 * PUBLIC_INTERFACE
 * buildUserIdToNameMap
 * Builds a best-effort id->displayName map using:
 * - Embedded record fields (user_name on records, etc.)
 * - /api/users list (scoped via auth token provider; query params are sanitized to only organization_id)
 *
 * Note: /api/users list endpoint is intentionally restrictive in this codebase; it only accepts organization_id
 * and ignores pagination/sort/filter. That's OK: we only need a lookup dictionary for display names.
 *
 * @param {any[]} records
 * @param {Object} [options]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<Record<string,string>>}
 */
export async function buildUserIdToNameMap(records = [], options = {}) {
  const map = {};

  // 1) Seed from embedded record fields
  (Array.isArray(records) ? records : []).forEach((r) => {
    const id = getUserIdentifierFromRecord(r);
    if (!id) return;
    const embedded = getEmbeddedUserDisplayName(r);
    const email = getEmbeddedUserEmail(r);

    // Prefer embedded name; otherwise use email as a placeholder "name"
    const value = embedded || email;
    if (value && typeof value === "string" && value.trim()) {
      map[String(id)] = value.trim();
    }
  });

  // 2) Enrich from /api/users
  try {
    const resp = await listUsers({}, { signal: options.signal });
    const users = Array.isArray(resp?.items) ? resp.items : [];
    const fromUsers = buildUserIdMapFromUsers(users);

    Object.entries(fromUsers).forEach(([id, name]) => {
      // Prefer "real" names; but if existing is an email placeholder, allow override
      const existing = map[id];
      const existingLooksLikeEmail = typeof existing === "string" && existing.includes("@");
      if (!existing || existingLooksLikeEmail) map[id] = name;
    });
  } catch (e) {
    // Non-fatal; keep embedded mapping only.
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.debug("[userDisplay] buildUserIdToNameMap: listUsers failed; using embedded mapping only", e);
    }
  }

  return map;
}
