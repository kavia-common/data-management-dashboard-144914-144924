# Users Analytics – Quick Range Verification (Frontend)

This note documents how to verify the fix for **Users Analytics** Quick Range behavior.

## What was fixed

- Users Analytics should **only call**:
  - `GET /api/users/:userId/sessions?organization_id=...&from=...&to=...`
- Users Analytics should **not call**:
  - `GET /api/session-tracking` (or any session tracking endpoint) when the Quick Range changes.
- Bars and tooltip metrics (sessions + projects) must reflect the **selected range** only.

## Manual verification steps

1. Open the app and navigate to **Users**.
2. Open the browser DevTools → **Network** tab.
3. In the **Users Analytics** panel:
   - Select `Today`, `Yesterday`, `Last 7 days`, etc.
   - Confirm the network activity is **debounced** (no request storms) and that the only backend calls are:
     - Path contains: `/api/users/<userId>/sessions`
     - Query contains:
       - `organization_id=<tenantId>`
       - `from=<ISO...>`
       - `to=<ISO...>`
   - Confirm **no** requests fire to:
     - `/api/session-tracking`

4. Confirm bar height reflects **sessions** in the selected range and tooltip shows:
   - User name
   - Sessions (range)
   - Projects (range)
=======

## Notes

- The global test suite currently fails in CI due to missing DOM APIs such as `ResizeObserver` required by Recharts under Jest/jsdom.
  This change does not introduce those failures, and manual verification via Network tab is the recommended validation for this issue.
