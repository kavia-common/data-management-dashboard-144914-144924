# Session Details Modal

Usage example:

import React, { useState } from 'react';
import { SessionDetailsModal } from './src/components';

function UsersPageRow({ user }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>View Sessions</button>
      <SessionDetailsModal
        isOpen={open}
        onClose={() => setOpen(false)}
        userId={user.user_id || user._id}
        tenantId={user.tenant_id}
      />
    </>
  );
}

The modal calls GET /api/sessions/details?user_id=<id>[&tenant_id=<tenant>] and displays:
- sessions list (start, end, duration)
- total_sessions
- total_duration (seconds), formatted for readability
- includes loading and error states
